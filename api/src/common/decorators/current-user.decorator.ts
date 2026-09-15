import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../users/user.entity';

/** Petición que ya pasó por `JwtAuthGuard`: lleva el usuario leído de la BD. */
export interface AuthenticatedRequest extends Request {
  user: User;
}

/** Usuario autenticado de la petición (con rol y estado leídos de la BD en esta misma petición). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
