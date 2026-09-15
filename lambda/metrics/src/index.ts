import { Pool } from 'pg';
import { computeMetrics, type Metrics, type StatusCountRow } from './computeMetrics';

export interface MetricsResult extends Metrics {
  generatedAt: string;
}

const METRICS_SQL = 'SELECT status, COUNT(*)::int AS count FROM notes GROUP BY status';

// Fuera del handler: el entorno de ejecución de Lambda reutiliza el pool (y su conexión) entre
// invocaciones. La conexión sale de las variables estándar PGHOST, PGPORT, PGUSER, PGPASSWORD
// y PGDATABASE. Una sola conexión basta: cada entorno atiende una invocación a la vez.
const pool = new Pool({
  max: 1,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 60_000,
});

// Sin este listener, el error de una conexión inactiva (p. ej. la BD se reinicia) tumbaría el
// proceso. El pool descarta esa conexión y abre otra en la siguiente invocación.
pool.on('error', (error) => {
  console.error('Error en una conexión inactiva con PostgreSQL', error);
});

/** Calcula y entrega las métricas del tablero. El evento se ignora. */
export async function handler(): Promise<MetricsResult> {
  try {
    const { rows } = await pool.query<StatusCountRow>(METRICS_SQL);
    return { ...computeMetrics(rows), generatedAt: new Date().toISOString() };
  } catch (error) {
    console.error('No se pudieron calcular las métricas', error);
    throw error;
  }
}
