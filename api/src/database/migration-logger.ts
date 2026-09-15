import type { Logger } from 'typeorm';

/**
 * Logger de TypeORM para la CLI de migraciones.
 *
 * `typeorm migration:run` activa por defecto el log de todas las consultas con sus
 * parámetros, lo que dejaría en los logs del contenedor los hashes bcrypt de las cuentas
 * demo. Este logger muestra el progreso de las migraciones y los errores, pero nunca los
 * parámetros de las consultas.
 */
export class MigrationLogger implements Logger {
  logQuery(): void {
    // Consultas individuales omitidas: basta con los mensajes de progreso.
  }

  logQuerySlow(): void {
    // Sin interés en migraciones de una sola ejecución.
  }

  logQueryError(error: string | Error, query: string): void {
    console.error(`Consulta fallida: ${query}`);
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
  }

  logSchemaBuild(message: string): void {
    console.log(message);
  }

  logMigration(message: string): void {
    console.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }
}
