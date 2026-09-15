import { computeMetrics } from './computeMetrics';

describe('computeMetrics', () => {
  it('suma el total y reparte las notas por estado', () => {
    expect(
      computeMetrics([
        { status: 'pending', count: 3 },
        { status: 'in_progress', count: 2 },
        { status: 'done', count: 2 },
      ]),
    ).toEqual({ total: 7, byStatus: { pending: 3, in_progress: 2, done: 2 } });
  });

  it('pone a 0 los estados que no aparecen en el resultado', () => {
    expect(computeMetrics([{ status: 'done', count: 4 }])).toEqual({
      total: 4,
      byStatus: { pending: 0, in_progress: 0, done: 4 },
    });
  });

  it('sin notas devuelve todo a 0', () => {
    expect(computeMetrics([])).toEqual({
      total: 0,
      byStatus: { pending: 0, in_progress: 0, done: 0 },
    });
  });

  it('ignora estados desconocidos', () => {
    expect(
      computeMetrics([
        { status: 'pending', count: 1 },
        { status: 'archived', count: 5 },
      ]),
    ).toEqual({ total: 1, byStatus: { pending: 1, in_progress: 0, done: 0 } });
  });
});
