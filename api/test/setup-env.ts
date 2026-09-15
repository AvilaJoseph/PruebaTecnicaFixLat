import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Jest ejecuta este archivo antes de cada suite (setupFiles): carga api/.env.test para que
// ConfigModule y TypeORM apunten a la base de datos de docker compose.
//
// No se usa process.loadEnvFile(): escribe en el entorno del proceso real, pero cada suite
// de Jest trabaja con su propia copia de process.env. Las variables ya definidas en el
// entorno tienen prioridad sobre las del archivo.
const envFile = resolve(__dirname, '..', '.env.test');

if (existsSync(envFile)) {
  const values = parseEnv(readFileSync(envFile, 'utf8')) as Record<
    string,
    string
  >;
  for (const [key, value] of Object.entries(values)) {
    process.env[key] ??= value;
  }
}
