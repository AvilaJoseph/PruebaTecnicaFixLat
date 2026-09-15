import { ConflictException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { In, Not, Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import type { ApiErrorBody } from './../src/common/filters/http-error.filter';
import { setupApp } from './../src/setup-app';
import type { UserResponse } from './../src/users/user-response';
import { User, UserRole } from './../src/users/user.entity';
import { UsersService } from './../src/users/users.service';

const PASSWORD = 'Clave-de-prueba-123';
/** UUID válido que no corresponde a ningún usuario. */
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

type Method = 'get' | 'post' | 'patch';

function errorCode(response: request.Response): string {
  return (response.body as ApiErrorBody).error.code;
}

function userOf(response: request.Response): UserResponse {
  return (response.body as { user: UserResponse }).user;
}

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let usersService: UsersService;
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let admin: User;
  let adminCookie: string;
  let member: User;
  let memberCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    users = moduleRef.get(getRepositoryToken(User));
    usersService = moduleRef.get(UsersService);

    admin = await createUser('admin', UserRole.ADMIN);
    member = await createUser('member');
    adminCookie = await sessionFor(admin.email);
    memberCookie = await sessionFor(member.email);
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await users.delete(userIds);
    }
    await app.close();
  });

  function emailFor(label: string): string {
    return `s5-${label}-${suffix}@test.local`;
  }

  async function createUser(
    label: string,
    role = UserRole.USER,
  ): Promise<User> {
    const user = await users.save(
      users.create({
        name: `Prueba S5 ${label}`,
        email: emailFor(label),
        passwordHash: await hash(PASSWORD, 4),
        role,
        active: true,
      }),
    );
    userIds.push(user.id);
    return user;
  }

  function login(email: string, password = PASSWORD) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  /** Inicia sesión y devuelve la cabecera `Cookie` lista para reenviar. */
  async function sessionFor(email: string, password = PASSWORD) {
    const response = await login(email, password).expect(200);
    const header = response.headers['set-cookie'] as unknown;
    const cookie = (Array.isArray(header) ? (header as string[]) : []).find(
      (c) => c.startsWith('session='),
    );
    if (!cookie) {
      throw new Error('El login no emitió la cookie de sesión');
    }
    return cookie.split(';')[0];
  }

  function call(method: Method, path: string, cookie?: string) {
    const req = request(app.getHttpServer())[method](`/api${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  /** Crea un usuario por la API (como admin) y lo registra para borrarlo al final. */
  async function createViaApi(body: object): Promise<request.Response> {
    const response = await call('post', '/users', adminCookie).send(body);
    if (response.status === 201) {
      userIds.push(userOf(response).id);
    }
    return response;
  }

  describe('control de acceso', () => {
    const routes: [Method, string][] = [
      ['get', '/users'],
      ['post', '/users'],
      ['patch', `/users/${MISSING_ID}`],
    ];

    it.each(routes)(
      '%s %s sin sesión responde 401 UNAUTHORIZED',
      async (method, path) => {
        const response = await call(method, path).expect(401);

        expect(errorCode(response)).toBe('UNAUTHORIZED');
      },
    );

    it.each(routes)(
      '%s %s con rol user responde 403 FORBIDDEN',
      async (method, path) => {
        const response = await call(method, path, memberCookie)
          .send({})
          .expect(403);

        expect(errorCode(response)).toBe('FORBIDDEN');
      },
    );
  });

  describe('GET /api/users', () => {
    it('lista a todos los usuarios solo con los campos públicos', async () => {
      const response = await call('get', '/users', adminCookie).expect(200);

      const list = response.body as UserResponse[];
      expect(list).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: admin.id, role: 'admin' }),
          expect.objectContaining({ id: member.id, role: 'user' }),
        ]),
      );
      for (const user of list) {
        expect(Object.keys(user).sort()).toEqual([
          'active',
          'createdAt',
          'email',
          'id',
          'name',
          'role',
          'updatedAt',
        ]);
      }
    });
  });

  describe('POST /api/users', () => {
    it('crea el usuario activo con el correo normalizado y ese usuario inicia sesión con la contraseña asignada', async () => {
      const email = emailFor('created');

      const response = await createViaApi({
        name: '  Ana Prueba  ',
        email: `  ${email.toUpperCase()} `,
        password: PASSWORD,
        role: 'user',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user: {
          id: expect.any(String) as string,
          name: 'Ana Prueba',
          email,
          role: 'user',
          active: true,
          createdAt: expect.any(String) as string,
          updatedAt: expect.any(String) as string,
        },
      });
      const stored = await users
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.id = :id', { id: userOf(response).id })
        .getOneOrFail();
      expect(stored.passwordHash).not.toBe(PASSWORD);
      await expect(compare(PASSWORD, stored.passwordHash)).resolves.toBe(true);

      const cookie = await sessionFor(email);
      await call('get', '/users', cookie).expect(403);
    });

    it('crea administradores: el nuevo administrador accede a la administración', async () => {
      const email = emailFor('created-admin');

      const response = await createViaApi({
        name: 'Admin nuevo',
        email,
        password: PASSWORD,
        role: 'admin',
      });

      expect(response.status).toBe(201);
      await call('get', '/users', await sessionFor(email)).expect(200);
    });

    it('responde 409 EMAIL_TAKEN si el correo ya existe, sin distinguir mayúsculas', async () => {
      const response = await createViaApi({
        name: 'Duplicado',
        email: member.email.toUpperCase(),
        password: PASSWORD,
        role: 'user',
      });

      expect(response.status).toBe(409);
      expect(errorCode(response)).toBe('EMAIL_TAKEN');
    });

    const valid = {
      name: 'Nombre',
      email: 'no-se-crea@test.local',
      password: PASSWORD,
      role: 'user',
    };

    it.each([
      [
        'falta el rol',
        { name: valid.name, email: valid.email, password: valid.password },
      ],
      ['el rol no existe', { ...valid, role: 'owner' }],
      ['el nombre tiene solo espacios', { ...valid, name: '   ' }],
      ['el nombre supera 120 caracteres', { ...valid, name: 'a'.repeat(121) }],
      ['el correo no es válido', { ...valid, email: 'no-es-un-correo' }],
      [
        'la contraseña tiene menos de 8 caracteres',
        { ...valid, password: '1234567' },
      ],
      [
        'la contraseña supera 128 caracteres',
        { ...valid, password: 'a'.repeat(129) },
      ],
      [
        'incluye el estado (siempre se crea activo)',
        { ...valid, active: false },
      ],
    ])('responde 422 VALIDATION_ERROR si %s', async (_case, body) => {
      const response = await createViaApi(body);

      expect(response.status).toBe(422);
      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('edita nombre, correo y rol; el nuevo rol aplica a la sesión abierta sin volver a entrar', async () => {
      const target = await createUser('edit');
      const cookie = await sessionFor(target.email);
      await call('get', '/users', cookie).expect(403);
      const email = emailFor('edited');

      const response = await call('patch', `/users/${target.id}`, adminCookie)
        .send({ name: 'Nombre editado', email, role: 'admin' })
        .expect(200);

      expect(userOf(response)).toMatchObject({
        id: target.id,
        name: 'Nombre editado',
        email,
        role: 'admin',
        active: true,
      });
      await call('get', '/users', cookie).expect(200);
    });

    it('restablece la contraseña: la anterior deja de valer y la nueva permite iniciar sesión', async () => {
      const target = await createUser('password');
      const newPassword = 'Nueva-clave-456';

      await call('patch', `/users/${target.id}`, adminCookie)
        .send({ password: newPassword })
        .expect(200);

      await login(target.email).expect(401);
      await login(target.email, newPassword).expect(200);
    });

    it('desactivar expulsa la sesión abierta e impide entrar; reactivar permite volver a entrar', async () => {
      const target = await createUser('deactivate');
      const cookie = await sessionFor(target.email);
      await call('get', '/auth/me', cookie).expect(200);

      const deactivated = await call(
        'patch',
        `/users/${target.id}`,
        adminCookie,
      )
        .send({ active: false })
        .expect(200);

      expect(userOf(deactivated).active).toBe(false);
      await call('get', '/auth/me', cookie).expect(401);
      expect(errorCode(await login(target.email).expect(403))).toBe(
        'USER_INACTIVE',
      );

      const reactivated = await call(
        'patch',
        `/users/${target.id}`,
        adminCookie,
      )
        .send({ active: true })
        .expect(200);

      expect(userOf(reactivated).active).toBe(true);
      await login(target.email).expect(200);
    });

    it('responde 409 EMAIL_TAKEN al usar el correo de otro usuario', async () => {
      const target = await createUser('email-taken');

      const response = await call('patch', `/users/${target.id}`, adminCookie)
        .send({ email: member.email })
        .expect(409);

      expect(errorCode(response)).toBe('EMAIL_TAKEN');
    });

    it('sin campos responde 200 con el usuario sin cambios', async () => {
      const response = await call('patch', `/users/${member.id}`, adminCookie)
        .send({})
        .expect(200);

      expect(userOf(response)).toMatchObject({
        id: member.id,
        email: member.email,
        role: 'user',
        active: true,
      });
    });

    it.each([
      ['el nombre es null', { name: null }],
      ['el nombre tiene solo espacios', { name: '  ' }],
      ['el correo no es válido', { email: 'x' }],
      ['la contraseña es demasiado corta', { password: 'corta' }],
      ['el rol no existe', { role: 'owner' }],
      ['el estado llega como texto', { active: 'false' }],
      ['el estado es null', { active: null }],
      ['incluye un campo no permitido', { id: MISSING_ID }],
    ])('responde 422 VALIDATION_ERROR si %s', async (_case, body) => {
      const response = await call('patch', `/users/${member.id}`, adminCookie)
        .send(body)
        .expect(422);

      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    });

    it('responde 404 USER_NOT_FOUND con un id inexistente y 422 con un id que no es UUID', async () => {
      const missing = await call('patch', `/users/${MISSING_ID}`, adminCookie)
        .send({ name: 'Nadie' })
        .expect(404);
      const malformed = await call('patch', '/users/no-es-un-uuid', adminCookie)
        .send({ name: 'Nadie' })
        .expect(422);

      expect(errorCode(missing)).toBe('USER_NOT_FOUND');
      expect(errorCode(malformed)).toBe('VALIDATION_ERROR');
    });
  });

  /**
   * La regla cuenta a todos los administradores activos de la BD, incluidas las cuentas demo.
   * Cada test desactiva temporalmente a los demás para que `admin` sea el único, y los reactiva
   * al terminar aunque el test falle. Por eso las suites e2e se ejecutan en serie (`maxWorkers`).
   */
  describe('siempre queda al menos un administrador activo', () => {
    let sidelinedIds: string[] = [];

    beforeEach(async () => {
      const others = await users.findBy({
        role: UserRole.ADMIN,
        active: true,
        id: Not(admin.id),
      });
      sidelinedIds = others.map((user) => user.id);
      if (sidelinedIds.length > 0) {
        await users.update({ id: In(sidelinedIds) }, { active: false });
      }
    });

    afterEach(async () => {
      await users.update(admin.id, { role: UserRole.ADMIN, active: true });
      if (sidelinedIds.length > 0) {
        await users.update({ id: In(sidelinedIds) }, { active: true });
      }
    });

    function activeAdminCount(): Promise<number> {
      return users.countBy({ role: UserRole.ADMIN, active: true });
    }

    it('el único administrador activo no puede desactivarse ni perder el rol (409 LAST_ADMIN)', async () => {
      for (const body of [
        { active: false },
        { role: 'user' },
        { role: 'user', active: false },
      ]) {
        const response = await call('patch', `/users/${admin.id}`, adminCookie)
          .send(body)
          .expect(409);
        expect(errorCode(response)).toBe('LAST_ADMIN');
      }

      await expect(
        users.findOneByOrFail({ id: admin.id }),
      ).resolves.toMatchObject({ role: UserRole.ADMIN, active: true });
      await call('get', '/users', adminCookie).expect(200);
    });

    it('con otro administrador activo sí se permite, y la regla vuelve a aplicar cuando queda uno', async () => {
      const second = await createUser('second-admin', UserRole.ADMIN);

      await call('patch', `/users/${second.id}`, adminCookie)
        .send({ role: 'user' })
        .expect(200);
      await call('patch', `/users/${admin.id}`, adminCookie)
        .send({ active: false })
        .expect(409);

      await call('patch', `/users/${second.id}`, adminCookie)
        .send({ role: 'admin' })
        .expect(200);
      // Un administrador puede quitarse el rol a sí mismo si no es el último.
      await call('patch', `/users/${admin.id}`, adminCookie)
        .send({ role: 'user' })
        .expect(200);

      await call('get', '/users', adminCookie).expect(403);
      expect(await activeAdminCount()).toBe(1);
    });

    it('modificar a un usuario sin rol admin o ya inactivo no se ve afectado por la regla', async () => {
      const inactiveAdmin = await createUser('inactive-admin', UserRole.ADMIN);
      await users.update(inactiveAdmin.id, { active: false });

      await call('patch', `/users/${member.id}`, adminCookie)
        .send({ active: false })
        .expect(200);
      await call('patch', `/users/${inactiveAdmin.id}`, adminCookie)
        .send({ role: 'user' })
        .expect(200);

      await call('patch', `/users/${member.id}`, adminCookie)
        .send({ active: true })
        .expect(200);
    });

    /*
     * Se llama al servicio directamente: por HTTP, si una petición desactivara a quien la envía,
     * la otra podría fallar antes en el guard de sesión (401) y no se probaría la carrera.
     */
    it('ante dos desactivaciones simultáneas de los dos últimos administradores, una se rechaza', async () => {
      const second = await createUser('race-admin', UserRole.ADMIN);

      const results = await Promise.allSettled([
        usersService.update(admin.id, { active: false }),
        usersService.update(second.id, { active: false }),
      ]);

      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      const reason = rejected[0].reason as unknown;
      expect(reason).toBeInstanceOf(ConflictException);
      expect((reason as ConflictException).getResponse()).toMatchObject({
        code: 'LAST_ADMIN',
      });
      expect(await activeAdminCount()).toBe(1);
    });
  });
});
