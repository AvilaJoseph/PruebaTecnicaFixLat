import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupApp } from './../src/setup-app';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde 200 con el estado de la API y la base de datos', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', db: 'ok' });
  });

  it('una ruta inexistente responde 404 con la forma de error estándar', () => {
    return request(app.getHttpServer())
      .get('/api/no-existe')
      .expect(404)
      .expect({
        error: { code: 'NOT_FOUND', message: 'Cannot GET /api/no-existe' },
      });
  });
});
