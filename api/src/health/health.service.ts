import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: 'ok';
  db: 'ok';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Comprueba la conexión a PostgreSQL; si falla responde `503 DB_UNAVAILABLE`. */
  async check(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.error(
        'La base de datos no responde',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        message: 'La base de datos no está disponible',
      });
    }
    return { status: 'ok', db: 'ok' };
  }
}
