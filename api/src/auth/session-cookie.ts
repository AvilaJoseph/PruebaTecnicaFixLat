import type { CookieOptions } from 'express';

/** Cookie que transporta el JWT de sesión. */
export const SESSION_COOKIE = 'session';

/** Duración de la sesión: la del JWT y la de la cookie coinciden. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Contenido del JWT: solo el id. Rol y estado se leen de la BD en cada petición. */
export interface SessionPayload {
  sub: string;
}

/**
 * Opciones con las que se emite y se borra la cookie. Para borrarla, el navegador exige el
 * mismo nombre y `path`; se reutilizan todas para que ambas operaciones no diverjan.
 */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  };
}
