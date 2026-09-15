import { api } from './client';
import type { NoteStatus } from './notes';

/** Respuesta de `GET /api/metrics`: calculada y entregada por la Lambda de métricas. */
export interface Metrics {
  total: number;
  byStatus: Record<NoteStatus, number>;
  /** Momento del cálculo (ISO-8601). */
  generatedAt: string;
  source: 'lambda';
}

export const metricsApi = {
  get: (signal?: AbortSignal) => api.get<Metrics>('/metrics', { signal }),
};
