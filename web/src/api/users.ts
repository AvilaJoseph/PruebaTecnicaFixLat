import type { User, UserRole } from '../auth/types';
import { ApiError, api } from './client';

export interface CreateUserInput {
  name: string;
  email: string;
  /** Contraseña inicial: con ella y el correo inicia sesión el nuevo usuario. */
  password: string;
  role: UserRole;
}

/** Solo los campos que cambian; `password` restablece la contraseña. */
export type UpdateUserInput = Partial<CreateUserInput & { active: boolean }>;

/** Límites que valida la API (`api/src/users/dto/user-fields.ts`). */
export const USER_NAME_MAX_LENGTH = 120;
export const USER_EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const usersApi = {
  list: (signal?: AbortSignal) => api.get<User[]>('/users', { signal }),

  create: async (input: CreateUserInput) =>
    (await api.post<{ user: User }>('/users', input)).user,

  update: async (id: string, changes: UpdateUserInput) =>
    (await api.patch<{ user: User }>(`/users/${id}`, changes)).user,
};

/** Mensaje para los errores de `/api/users`. */
export function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'LAST_ADMIN':
        return 'Debe quedar al menos un administrador activo. Da el rol de administrador a otra cuenta antes de desactivar esta o quitarle el rol.';
      case 'EMAIL_TAKEN':
        return 'Ya existe un usuario con ese correo electrónico.';
      case 'USER_NOT_FOUND':
        return 'El usuario ya no existe. Recarga la página.';
      case 'VALIDATION_ERROR':
        return 'Revisa los datos del formulario.';
      case 'NETWORK_ERROR':
        return error.message;
    }
  }
  return fallback;
}
