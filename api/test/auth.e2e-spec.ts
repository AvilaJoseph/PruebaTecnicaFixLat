import { Controller, Get, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { Roles } from './../src/common/decorators/roles.decorator';
import type { ApiErrorBody } from './../src/common/filters/http-error.filter';
import { setupApp } from './../src/setup-app';
import type { UserResponse } from './../src/users/user-response';
import { User, UserRole } from './../src/users/user.entity';

/** Ruta solo para admin que existe únicamente en esta suite: prueba los guards globales juntos. */
@Controller('test-admin-probe')
class AdminProbeController {
  @Roles('admin')
  @Get()
  probe() {
    return { ok: true };
  }
}

const PASSWORD = 'Clave-de-prueba-123';

function errorCode(response: request.Response): string {
  return (response.body as ApiErrorBody).error.code;
}

function userOf(response: request.Response): UserResponse {
  return (response.body as { user: UserResponse }).user;
}

const SESSION_COOKIE_PATTERN =
  /^session=[^;]+; Max-Age=28800; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax$/;
const CLEARED_COOKIE_PATTERN =
  /^session=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax$/;

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  const suffix = randomUUID().slice(0, 8);
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminProbeController],
    }).compile();

    app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    users = moduleRef.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await users.delete(createdIds);
    }
    await app.close();
  });

  async function createUser(
    label: string,
    overrides: Partial<Pick<User, 'role' | 'active'>> = {},
  ): Promise<User> {
    const user = await users.save(
      users.create({
        name: `Prueba S2 ${label}`,
        email: `s2-${label}-${suffix}@test.local`,
        passwordHash: await hash(PASSWORD, 4),
        role: UserRole.USER,
        active: true,
        ...overrides,
      }),
    );
    createdIds.push(user.id);
    return user;
  }

  function login(email: string, password = PASSWORD) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  function setCookies(response: request.Response): string[] {
    const header = response.headers['set-cookie'] as unknown;
    return Array.isArray(header) ? (header as string[]) : [];
  }

  /** Inicia sesión y devuelve la cabecera `Cookie` lista para reenviar. */
  async function sessionFor(user: User): Promise<string> {
    const response = await login(user.email).expect(200);
    const cookie = setCookies(response).find((c) => c.startsWith('session='));
    if (!cookie) {
      throw new Error('El login no emitió la cookie de sesión');
    }
    return cookie.split(';')[0];
  }

  function me(cookie?: string) {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return cookie ? req.set('Cookie', cookie) : req;
  }

  describe('POST /api/auth/login', () => {
    it('con credenciales válidas responde 200 {user} sin hash y emite la cookie de sesión', async () => {
      const user = await createUser('login-ok');

      const response = await login(user.email).expect(200);

      expect(response.body).toEqual({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'user',
          active: true,
          createdAt: expect.any(String) as string,
          updatedAt: expect.any(String) as string,
        },
      });
      expect(setCookies(response)).toEqual([
        expect.stringMatching(SESSION_COOKIE_PATTERN),
      ]);
    });

    it('normaliza el correo (mayúsculas y espacios)', async () => {
      const user = await createUser('login-case');

      await login(`  ${user.email.toUpperCase()} `).expect(200);
    });

    it('con contraseña incorrecta o correo inexistente responde 401 INVALID_CREDENTIALS', async () => {
      const user = await createUser('login-bad');
      const expected = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Correo o contraseña incorrectos',
        },
      };

      const wrongPassword = await login(user.email, 'otra-clave').expect(401);
      const unknownEmail = await login(`nadie-${suffix}@test.local`).expect(
        401,
      );

      expect(wrongPassword.body).toEqual(expected);
      expect(unknownEmail.body).toEqual(expected);
    });

    it('a un usuario inactivo con la contraseña correcta responde 403 USER_INACTIVE sin cookie', async () => {
      const user = await createUser('login-inactive', { active: false });

      const response = await login(user.email).expect(403);

      expect(errorCode(response)).toBe('USER_INACTIVE');
      expect(setCookies(response)).toEqual([]);
    });

    it('a un usuario inactivo con contraseña incorrecta no le revela su estado (401)', async () => {
      const user = await createUser('login-inactive-bad', { active: false });

      const response = await login(user.email, 'otra-clave').expect(401);

      expect(errorCode(response)).toBe('INVALID_CREDENTIALS');
    });

    it('valida el cuerpo: 422 si falta un campo o sobra alguno', async () => {
      const server = app.getHttpServer();

      const missing = await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin@demo.test' })
        .expect(422);
      const extra = await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin@demo.test', password: 'x', role: 'admin' })
        .expect(422);

      expect(errorCode(missing)).toBe('VALIDATION_ERROR');
      expect(errorCode(extra)).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/me', () => {
    it('sin cookie responde 401 UNAUTHORIZED', async () => {
      const response = await me().expect(401);

      expect(errorCode(response)).toBe('UNAUTHORIZED');
    });

    it('con sesión responde 200 {user}', async () => {
      const user = await createUser('me-ok');
      const cookie = await sessionFor(user);

      const response = await me(cookie).expect(200);

      expect(userOf(response)).toMatchObject({
        id: user.id,
        email: user.email,
        role: 'user',
        active: true,
      });
      expect(userOf(response)).not.toHaveProperty('passwordHash');
    });

    it('con un token manipulado o firmado con otro secreto responde 401 y borra la cookie', async () => {
      const user = await createUser('me-forged');
      const forged = new JwtService({ secret: 'otro-secreto' }).sign({
        sub: user.id,
      });

      for (const cookie of ['session=no-es-un-jwt', `session=${forged}`]) {
        const response = await me(cookie).expect(401);
        expect(setCookies(response)).toEqual([
          expect.stringMatching(CLEARED_COOKIE_PATTERN),
        ]);
      }
    });

    it('si el usuario se desactiva con la sesión abierta, su siguiente petición responde 401', async () => {
      const user = await createUser('me-deactivated');
      const cookie = await sessionFor(user);
      await me(cookie).expect(200);

      await users.update(user.id, { active: false });

      const response = await me(cookie).expect(401);
      expect(setCookies(response)).toEqual([
        expect.stringMatching(CLEARED_COOKIE_PATTERN),
      ]);

      await users.update(user.id, { active: true });
      await me(cookie).expect(200);
    });

    it('si el usuario se elimina con la sesión abierta, su siguiente petición responde 401', async () => {
      const user = await createUser('me-deleted');
      const cookie = await sessionFor(user);

      await users.delete(user.id);

      await me(cookie).expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('responde 204 y borra la cookie', async () => {
      const user = await createUser('logout');
      const cookie = await sessionFor(user);

      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(setCookies(response)).toEqual([
        expect.stringMatching(CLEARED_COOKIE_PATTERN),
      ]);
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });

  describe('guards globales en una ruta @Roles("admin")', () => {
    const probe = (cookie?: string) => {
      const req = request(app.getHttpServer()).get('/api/test-admin-probe');
      return cookie ? req.set('Cookie', cookie) : req;
    };

    it('sin sesión responde 401 (la autenticación se comprueba antes que el rol)', async () => {
      const response = await probe().expect(401);

      expect(errorCode(response)).toBe('UNAUTHORIZED');
    });

    it('con rol user responde 403 FORBIDDEN', async () => {
      const cookie = await sessionFor(await createUser('probe-user'));

      const response = await probe(cookie).expect(403);

      expect(errorCode(response)).toBe('FORBIDDEN');
    });

    it('con rol admin responde 200', async () => {
      const cookie = await sessionFor(
        await createUser('probe-admin', { role: UserRole.ADMIN }),
      );

      await probe(cookie).expect(200).expect({ ok: true });
    });

    it('el rol se lee de la BD en cada petición: un cambio de rol aplica sin volver a iniciar sesión', async () => {
      const user = await createUser('probe-promoted');
      const cookie = await sessionFor(user);
      await probe(cookie).expect(403);

      await users.update(user.id, { role: UserRole.ADMIN });

      await probe(cookie).expect(200);
    });
  });
});
