/** Estados de una nota (enum `note_status` de PostgreSQL, §5.2). */
export const NOTE_STATUSES = ['pending', 'in_progress', 'done'] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number];

/** Fila de `SELECT status, COUNT(*)::int AS count FROM notes GROUP BY status`. */
export interface StatusCountRow {
  status: string;
  count: number;
}

export interface Metrics {
  total: number;
  byStatus: Record<NoteStatus, number>;
}

/**
 * Convierte el conteo agrupado de la BD en las métricas del dashboard. Los estados sin notas
 * no aparecen en el `GROUP BY`, así que valen `0`; el total es la suma de los estados.
 */
export function computeMetrics(rows: readonly StatusCountRow[]): Metrics {
  const byStatus: Record<NoteStatus, number> = { pending: 0, in_progress: 0, done: 0 };

  for (const { status, count } of rows) {
    if (isNoteStatus(status)) {
      byStatus[status] += Number(count);
    }
  }

  const total = NOTE_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  return { total, byStatus };
}

function isNoteStatus(value: string): value is NoteStatus {
  return (NOTE_STATUSES as readonly string[]).includes(value);
}
