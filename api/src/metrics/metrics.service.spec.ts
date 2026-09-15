import { BadGatewayException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import { MetricsService } from './metrics.service';

const METRICS = {
  total: 7,
  byStatus: { pending: 3, in_progress: 2, done: 2 },
  generatedAt: '2026-09-14T15:30:00.000Z',
};

function payloadOf(value: unknown): Uint8Array {
  return new TextEncoder().encode(
    typeof value === 'string' ? value : JSON.stringify(value),
  );
}

describe('MetricsService', () => {
  let send: jest.Mock;
  let service: MetricsService;

  beforeEach(() => {
    send = jest.fn();
    const config = { getOrThrow: () => 'metrics-fn' };
    service = new MetricsService(
      { send } as unknown as LambdaClient,
      config as unknown as ConfigService,
    );
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  async function expectUnavailable() {
    const error = await service.getMetrics().then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).getResponse()).toMatchObject({
      code: 'METRICS_UNAVAILABLE',
    });
  }

  it('invoca la función configurada con el evento {} y devuelve sus métricas', async () => {
    send.mockResolvedValue({ StatusCode: 200, Payload: payloadOf(METRICS) });

    await expect(service.getMetrics()).resolves.toEqual(METRICS);

    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0] as [InvokeCommand];
    expect(command).toBeInstanceOf(InvokeCommand);
    expect(command.input).toEqual({
      FunctionName: 'metrics-fn',
      Payload: '{}',
    });
  });

  it('descarta campos que no forman parte del contrato', async () => {
    send.mockResolvedValue({
      Payload: payloadOf({
        ...METRICS,
        byStatus: { ...METRICS.byStatus, archived: 9 },
        extra: true,
      }),
    });

    await expect(service.getMetrics()).resolves.toEqual(METRICS);
  });

  it('responde 502 METRICS_UNAVAILABLE si la invocación falla (p. ej. la Lambda no está levantada)', async () => {
    send.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expectUnavailable();
  });

  it('responde 502 METRICS_UNAVAILABLE si la función lanza un error', async () => {
    send.mockResolvedValue({
      StatusCode: 200,
      FunctionError: 'Unhandled',
      Payload: payloadOf({ errorMessage: 'connection refused' }),
    });

    await expectUnavailable();
  });

  it.each([
    ['no es JSON', 'Internal Server Error'],
    ['le falta un estado', { ...METRICS, byStatus: { pending: 1, done: 2 } }],
    ['tiene un total negativo', { ...METRICS, total: -1 }],
    ['tiene una fecha inválida', { ...METRICS, generatedAt: 'ayer' }],
  ])(
    'responde 502 METRICS_UNAVAILABLE si la respuesta %s',
    async (_case, body) => {
      send.mockResolvedValue({ Payload: payloadOf(body) });

      await expectUnavailable();
    },
  );
});
