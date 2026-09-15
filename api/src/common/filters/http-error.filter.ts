import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Forma única de los errores de la API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

const DEFAULT_CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * Filtro global que normaliza cualquier error a `{ error: { code, message } }`:
 *
 * - `new ConflictException({ code: 'LAST_ADMIN', message })` conserva su `code` y `message`.
 * - Las excepciones HTTP sin `code` (p. ej. `NotFoundException`) reciben uno según su estado.
 * - Los mensajes de validación (`422`) se unen en un solo texto.
 * - Los errores 4xx de middlewares de Express (p. ej. cuerpo demasiado grande) conservan su estado.
 * - Cualquier otro error responde `500 INTERNAL_ERROR` sin exponer detalles internos.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { status, body } = toErrorResponse(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }
}

export function toErrorResponse(exception: unknown): {
  status: number;
  body: ApiErrorBody;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const { code, message } =
      typeof payload === 'string'
        ? { code: undefined, message: payload }
        : (payload as { code?: unknown; message?: unknown });

    return {
      status,
      body: {
        error: {
          code:
            typeof code === 'string' && code !== ''
              ? code
              : defaultCode(status),
          message: toMessage(message) ?? exception.message,
        },
      },
    };
  }

  const clientStatus = exposedClientErrorStatus(exception);
  if (clientStatus !== undefined) {
    return {
      status: clientStatus,
      body: {
        error: {
          code: defaultCode(clientStatus),
          message: (exception as Error).message,
        },
      },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
    },
  };
}

function defaultCode(status: number): string {
  return DEFAULT_CODES[status] ?? `HTTP_${status}`;
}

function toMessage(message: unknown): string | undefined {
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map(String).join('; ');
  }
  return undefined;
}

/** Errores de `http-errors` (body-parser) marcados como públicos: `{ status: 4xx, expose: true }`. */
function exposedClientErrorStatus(exception: unknown): number | undefined {
  if (!(exception instanceof Error)) {
    return undefined;
  }
  const { status, expose } = exception as Error & {
    status?: unknown;
    expose?: unknown;
  };
  return typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    expose === true
    ? status
    : undefined;
}
