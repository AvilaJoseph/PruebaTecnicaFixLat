import 'reflect-metadata';
import { extname, join } from 'node:path';
import { DataSource } from 'typeorm';
import { MigrationLogger } from './migration-logger';

/**
 * DataSource para la CLI de TypeORM (`npm run migration:run`). La API usa TypeOrmModule con
 * la misma DATABASE_URL. En el contenedor se ejecuta compilado (dist/database/data-source.js),
 * por eso los patrones usan la extensión de este mismo archivo: `.js` en dist (sin incluir
 * los `.d.ts`) y `.ts` si se ejecuta con ts-node.
 *
 * El logger propio evita que la CLI imprima los parámetros de las consultas (hashes del seed).
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('La variable DATABASE_URL no está definida');
}

const ext = extname(__filename);

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [join(__dirname, '..', '**', `*.entity${ext}`)],
  migrations: [join(__dirname, 'migrations', `*${ext}`)],
  synchronize: false,
  logger: new MigrationLogger(),
});
