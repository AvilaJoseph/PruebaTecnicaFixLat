import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import type { LoginDto } from './dto/login.dto';
import type { SessionPayload } from './session-cookie';

/**
 * Hash bcrypt (10 rondas) de una contraseña aleatoria que no se usa en ningún sitio. Si el
 * correo no existe se compara igualmente contra él, para que el tiempo de respuesta no revele
 * qué correos están registrados.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$10$oCdT4fcdxVcB/GJ7KhypCegDkCbFJu7QVBsvJeljj1TU3bzu1r3IG';

export interface LoginResult {
  user: User;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Valida credenciales y emite el JWT de sesión.
   *
   * - Correo inexistente o contraseña incorrecta → `401 INVALID_CREDENTIALS` (mismo mensaje).
   * - Credenciales correctas de un usuario inactivo → `403 USER_INACTIVE`. Se comprueba después
   *   de la contraseña para no revelar el estado de una cuenta a quien no la conoce.
   */
  async login({ email, password }: LoginDto): Promise<LoginResult> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    const passwordMatches = await compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos',
      });
    }

    if (!user.active) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'El usuario está inactivo. Contacta con un administrador.',
      });
    }

    const payload: SessionPayload = { sub: user.id };
    const token = await this.jwtService.signAsync(payload);
    return { user, token };
  }
}
