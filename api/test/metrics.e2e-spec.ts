import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import type { ApiErrorBody } from './../src/common/filters/http-error.filter';
import { LAMBDA_CLIENT } from './../src/metrics/lambda.provider';
import { setupApp } from './../src/setup-app';
import { User, UserRole } from './../src/users/user.entity';

const PASSWORD = 'Clave-de-prueba-123';

const LAMBDA_METRICS = {
  total: 7,
  byStatus: { pending: 3, in_progress: 2, done: 2 },
  generatedAt: '2026-09-14T15:30:00.000Z',
};

/**
 * La Lambda se sustituye por un doble (`LAMBDA_CLIENT`): estos tests comprueban la ruta, la
 * sesión y el manejo de errores sin depender del contenedor metrics-lambda.
 */
describe('Metrics (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  const lambda = { send: jest.fn() };
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LAMBDA_CLIENT)
      .useValue(lambda)
      .compile();

    app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    users = moduleRef.get(getRepositoryToken(User));

    adminCookie = await sessionFor(await createUser('admin', UserRole.ADMIN));
    memberCookie = await sessionFor(await createUser('member', UserRole.USER));
  });

  beforeEach(() => {
    lambda.send.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (userIds.length > 0) {
      await users.delete(userIds);
    }
    await app.close();
  });

  async function createUser(label: string, role: UserRole): Promise<User> {
    const user = await users.save(
      users.create({
        name: `Prueba S4 ${label}`,
        email: `s4-${label}-${suffix}@test.local`,
        passwordHash: await hash(PASSWORD, 4),
        role,
        active: true,
      }),
    );
    userIds.push(user.id);
    return user;
  }

  /** Inicia sesión y devuelve la cabecera `Cookie` lista para reenviar. */
  async function sessionFor(user: User): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    const header = response.headers['set-cookie'] as unknown;
    const cookie = (Array.isArray(header) ? (header as string[]) : []).find(
      (c) => c.startsWith('session='),
    );
    if (!cookie) {
      throw new Error('El login no emitió la cookie de sesión');
    }
    return cookie.split(';')[0];
  }

  function getMetrics(cookie?: string) {
    const req = request(app.getHttpServer()).get('/api/metrics');
    return cookie ? req.set('Cookie', cookie) : req;
  }

  function lambdaReturns(body: unknown, functionError?: string) {
    lambda.send.mockResolvedValue({
      StatusCode: 200,
      FunctionError: functionError,
      Payload: new TextEncoder().encode(JSON.stringify(body)),
    });
  }

  /** Los 502 se registran como error: se silencian para no ensuciar la salida. */
  function silenceErrorLogs() {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  }

  it('sin sesión responde 401 UNAUTHORIZED y no invoca la Lambda', async () => {
    const response = await getMetrics().expect(401);

    expect((response.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED');
    expect(lambda.send).not.toHaveBeenCalled();
  });

  it.each([
    ['user', () => memberCookie],
    ['admin', () => adminCookie],
  ])(
    'con rol %s devuelve las métricas de la Lambda con source "lambda"',
    async (_role, cookie) => {
      lambdaReturns(LAMBDA_METRICS);

      const response = await getMetrics(cookie()).expect(200);

      expect(response.body).toEqual({ ...LAMBDA_METRICS, source: 'lambda' });
      expect(lambda.send).toHaveBeenCalledTimes(1);
    },
  );

  it('si la Lambda no responde devuelve 502 METRICS_UNAVAILABLE', async () => {
    silenceErrorLogs();
    lambda.send.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const response = await getMetrics(memberCookie).expect(502);

    expect(response.body).toEqual({
      error: {
        code: 'METRICS_UNAVAILABLE',
        message: 'Las métricas no están disponibles en este momento',
      },
    });
  });

  it('si la función falla devuelve 502 METRICS_UNAVAILABLE sin exponer el detalle', async () => {
    silenceErrorLogs();
    lambdaReturns(
      { errorMessage: 'password authentication failed' },
      'Unhandled',
    );

    const response = await getMetrics(memberCookie).expect(502);

    expect((response.body as ApiErrorBody).error.code).toBe(
      'METRICS_UNAVAILABLE',
    );
    expect(JSON.stringify(response.body)).not.toContain('password');
  });
});
