import type { User, UserRole } from './user.entity';

/** Forma pública de un usuario (§5.3). Nunca incluye el hash de la contraseña. */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Serialización explícita: copia solo los campos públicos, aunque la entidad traiga más. */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
