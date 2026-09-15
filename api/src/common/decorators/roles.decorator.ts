import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../users/user.entity';

/** Metadato que consulta el guard global de roles. */
export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta (o un controlador completo) a los roles indicados → `403 FORBIDDEN`.
 * Sin este decorador basta con tener sesión.
 */
export const Roles = (...roles: `${UserRole}`[]) =>
  SetMetadata(ROLES_KEY, roles);
