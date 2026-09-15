export type UserRole = 'admin' | 'user';

/** Forma `user` de la API (§5.3). */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuario',
};
