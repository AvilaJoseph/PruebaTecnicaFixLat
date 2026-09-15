import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import { NoteStatus } from '../notes/note.entity';
import { LAMBDA_CLIENT } from './lambda.provider';

/** Contrato de la respuesta de la Lambda de métricas (§5.4). */
export interface LambdaMetrics {
  total: number;
  byStatus: Record<NoteStatus, number>;
  generatedAt: string;
}

const STATUSES = Object.values(NoteStatus);

/** La Lambda ignora el evento (§5.4). */
const EMPTY_EVENT = '{}';

/**
 * Obtiene las métricas del tablero invocando la Lambda. La API no cuenta notas: solo comprueba
 * que la respuesta cumple el contrato. Cualquier fallo (red, error de la función o respuesta
 * inválida) se traduce en `502 METRICS_UNAVAILABLE`.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly functionName: string;

  constructor(
    @Inject(LAMBDA_CLIENT) private readonly lambda: LambdaClient,
    config: ConfigService,
  ) {
    this.functionName = config.getOrThrow<string>('METRICS_FUNCTION_NAME');
  }

  async getMetrics(): Promise<LambdaMetrics> {
    let payload: string;
    try {
      // El evento se envía explícito: sin Payload, el runtime de Node recibe un cuerpo vacío
      // y falla al parsearlo antes de llegar al handler.
      const result = await this.lambda.send(
        new InvokeCommand({
          FunctionName: this.functionName,
          Payload: EMPTY_EVENT,
        }),
      );
      payload = new TextDecoder().decode(result.Payload);
      if (result.FunctionError) {
        throw new Error(
          `La función respondió ${result.FunctionError}: ${payload}`,
        );
      }
    } catch (error) {
      throw this.unavailable('No se pudo invocar la Lambda de métricas', error);
    }

    const metrics = parseMetrics(payload);
    if (!metrics) {
      throw this.unavailable(
        'La Lambda de métricas devolvió una respuesta inválida',
        payload,
      );
    }
    return metrics;
  }

  private unavailable(reason: string, cause: unknown): BadGatewayException {
    this.logger.error(
      `${reason} (${this.functionName})`,
      cause instanceof Error ? cause.stack : String(cause),
    );
    return new BadGatewayException({
      code: 'METRICS_UNAVAILABLE',
      message: 'Las métricas no están disponibles en este momento',
    });
  }
}

/** Respuesta de la Lambda → métricas, o `null` si no cumple el contrato. */
function parseMetrics(payload: string): LambdaMetrics | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { total, byStatus, generatedAt } = value as Record<string, unknown>;
  if (
    !isCount(total) ||
    typeof generatedAt !== 'string' ||
    Number.isNaN(Date.parse(generatedAt)) ||
    typeof byStatus !== 'object' ||
    byStatus === null
  ) {
    return null;
  }

  const counts = byStatus as Record<string, unknown>;
  if (!STATUSES.every((status) => isCount(counts[status]))) {
    return null;
  }

  return {
    total,
    byStatus: Object.fromEntries(
      STATUSES.map((status) => [status, counts[status]]),
    ) as Record<NoteStatus, number>,
    generatedAt,
  };
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}
