import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  type SessionPayload,
} from '../../auth/session-cookie';
import { User } from '../../users/user.entity';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard global (primer `APP_GUARD`): toda ruta exige sesión salvo las marcadas con `@Public()`.
 *
 * Verifica el JWT de la cookie y **consulta el usuario en la BD en cada petición**: si ya no
 * existe o fue desactivado responde `401` aunque el token siga vigente, y el rol que ven los
 * guards y controladores es siempre el actual. Cuando rechaza una cookie, la borra.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const token = (request.cookies as Record<string, unknown> | undefined)?.[
      SESSION_COOKIE
    ];

    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Debes iniciar sesión',
      });
    }

    const user = await this.findSessionUser(token);
    if (!user) {
      http
        .getResponse<Response>()
        .clearCookie(
          SESSION_COOKIE,
          sessionCookieOptions(
            this.config.get<boolean>('COOKIE_SECURE', false),
          ),
        );
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'La sesión finalizó o el usuario está inactivo',
      });
    }

    (request as AuthenticatedRequest).user = user;
    return true;
  }

  /** Usuario activo dueño del token; `null` si el token no es válido o el usuario no puede entrar. */
  private async findSessionUser(token: string): Promise<User | null> {
    let payload: SessionPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }

    const user = await this.users.findOneBy({ id: payload.sub });
    return user?.active ? user : null;
  }
}
