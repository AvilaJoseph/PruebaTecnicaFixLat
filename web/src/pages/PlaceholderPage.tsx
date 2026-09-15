import { useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';

interface HealthResponse {
  status: string;
  db: string;
}

type ApiCheck = { state: 'loading' } | { state: 'ok' } | { state: 'error'; message: string };

/** Página provisional: confirma que el frontend se sirve y que el proxy /api llega a la API. */
export default function PlaceholderPage() {
  const [check, setCheck] = useState<ApiCheck>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<HealthResponse>('/health', { signal: controller.signal })
      .then((health) => {
        setCheck(
          health.status === 'ok' && health.db === 'ok'
            ? { state: 'ok' }
            : { state: 'error', message: 'respuesta inesperada' },
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setCheck({
          state: 'error',
          message: error instanceof ApiError ? error.message : 'error inesperado',
        });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="placeholder">
      <h1>Portal de equipo</h1>
      <p>Tablero compartido de notas, dashboard de métricas y administración de usuarios.</p>
      <p className="muted">Página provisional: el entorno base está en marcha.</p>
      <p className={`status status--${check.state}`} role="status">
        {check.state === 'loading' && 'Comprobando la API…'}
        {check.state === 'ok' && 'API y base de datos operativas'}
        {check.state === 'error' && `API no disponible: ${check.message}`}
      </p>
    </main>
  );
}
