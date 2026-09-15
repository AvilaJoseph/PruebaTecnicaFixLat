/**
 * Cliente HTTP de la API.
 *
 * Siempre usa la ruta relativa `/api`: en local la enruta nginx (o el proxy de Vite en
 * desarrollo) y en AWS un behavior de CloudFront. Así no hay CORS y la cookie de sesión
 * es same-origin.
 */
export const API_BASE_URL = '/api';

/** Forma única de los errores de la API: `{ "error": { "code": "...", "message": "..." } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** Error de una llamada a la API, con el código estándar ya extraído. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  /** Cuerpo de la petición; se envía serializado como JSON. */
  body?: unknown;
  /**
   * No avisar al manejador global de `401`. Lo usan el login (muestra su propio error) y la
   * comprobación inicial de la sesión (en una visita anónima el `401` es lo normal).
   */
  skipUnauthorizedHandler?: boolean;
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registra la reacción global a un `401` (la sesión expiró o el usuario fue desactivado o
 * eliminado). La instala AuthContext; `null` la retira.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

const INVALID_JSON = Symbol('invalid-json');

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: extraHeaders, skipUnauthorizedHandler = false, ...init } = options;
  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json');
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch (error) {
    // Una cancelación con AbortController no es un fallo de red: se propaga tal cual.
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  }

  const data = await readJson(response);
  if (response.status === 401 && !skipUnauthorizedHandler) {
    unauthorizedHandler?.();
  }
  if (response.ok && data !== INVALID_JSON) {
    return data as T;
  }
  if (isApiErrorBody(data)) {
    throw new ApiError(response.status, data.error.code, data.error.message);
  }
  throw new ApiError(
    response.status,
    'UNEXPECTED_RESPONSE',
    `Respuesta inesperada del servidor (HTTP ${response.status}).`,
  );
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/** Cuerpo vacío (p. ej. `204`) → `undefined`; cuerpo que no es JSON → `INVALID_JSON`. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return INVALID_JSON;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
