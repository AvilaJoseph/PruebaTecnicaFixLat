import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { metricsApi, type Metrics } from '../api/metrics';
import { NOTE_STATUSES, NOTE_STATUS_LABELS } from '../api/notes';

const percentFormat = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 0 });
const timeFormat = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function share(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'METRICS_UNAVAILABLE') {
      return 'El servicio de métricas (AWS Lambda) no respondió. Inténtalo de nuevo en unos segundos.';
    }
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
  }
  return 'No se pudieron cargar las métricas.';
}

/**
 * Total de notas y distribución por estado. Las cifras las calcula la Lambda en cada carga:
 * al abrir la página y al pulsar Actualizar.
 */
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await metricsApi.get(signal));
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }
      setError(errorMessage(loadError));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section className="dashboard" aria-busy={loading}>
      <header className="dashboard__toolbar">
        <div>
          <h1>Dashboard</h1>
          <p className="muted dashboard__hint">Resumen del tablero compartido del equipo.</p>
        </div>
        <div className="dashboard__actions">
          {metrics && (
            <span className="muted">
              Generado a las {timeFormat.format(new Date(metrics.generatedAt))} · vía AWS Lambda
            </span>
          )}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
          {metrics && ' Se muestran las últimas cifras obtenidas.'}
        </p>
      )}

      {!metrics && loading && (
        <p className="muted" role="status">
          Cargando métricas…
        </p>
      )}

      {metrics && <MetricsSummary metrics={metrics} stale={error !== null} />}
    </section>
  );
}

function MetricsSummary({ metrics, stale }: { metrics: Metrics; stale: boolean }) {
  const { total, byStatus } = metrics;
  const distribution = NOTE_STATUSES.map((status) => ({
    status,
    label: NOTE_STATUS_LABELS[status],
    count: byStatus[status],
    share: share(byStatus[status], total),
  }));

  return (
    <div className={stale ? 'dashboard__content dashboard__content--stale' : 'dashboard__content'}>
      <div className="metrics">
        <article className="card metric metric--total">
          <span className="metric__label">Total de notas</span>
          <span className="metric__value">{total}</span>
          <span className="metric__detail">en el tablero</span>
        </article>
        {distribution.map(({ status, label, count, share: statusShare }) => (
          <article key={status} className={`card metric status--${status}`}>
            <span className="metric__label">{label}</span>
            <span className="metric__value">{count}</span>
            <span className="metric__detail">{percentFormat.format(statusShare)} del total</span>
          </article>
        ))}
      </div>

      <article className="card distribution">
        <h2>Distribución por estado</h2>
        {total === 0 ? (
          <p className="muted distribution__empty">
            Aún no hay notas. Crea la primera en el <Link to="/tablero">tablero</Link>.
          </p>
        ) : (
          <>
            <div
              className="distribution__bar"
              role="img"
              aria-label={distribution
                .map(({ label, count, share: s }) => `${label}: ${count} (${percentFormat.format(s)})`)
                .join(', ')}
            >
              {distribution
                .filter(({ count }) => count > 0)
                .map(({ status, label, count, share: s }) => (
                  <div
                    key={status}
                    className={`distribution__segment status--${status}`}
                    style={{ width: `${s * 100}%` }}
                    title={`${label}: ${count}`}
                  />
                ))}
            </div>
            <ul className="distribution__legend">
              {distribution.map(({ status, label, count, share: s }) => (
                <li key={status} className={`status--${status}`}>
                  <span className="distribution__swatch" aria-hidden="true" />
                  {label}: <strong>{count}</strong> ({percentFormat.format(s)})
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </div>
  );
}
