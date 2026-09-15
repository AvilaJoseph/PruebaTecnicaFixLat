import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import type { ApiErrorBody } from './../src/common/filters/http-error.filter';
import { BOARD_HEIGHT, BOARD_WIDTH } from './../src/notes/dto/note-fields';
import type { NoteResponse } from './../src/notes/note-response';
import { Note } from './../src/notes/note.entity';
import { setupApp } from './../src/setup-app';
import { User, UserRole } from './../src/users/user.entity';

const PASSWORD = 'Clave-de-prueba-123';
/** UUID válido que no corresponde a ninguna nota. */
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

function errorCode(response: request.Response): string {
  return (response.body as ApiErrorBody).error.code;
}

function noteOf(response: request.Response): NoteResponse {
  return (response.body as { note: NoteResponse }).note;
}

describe('Notes (e2e)', () => {
  let app: INestApplication<App>;
  let users: Repository<User>;
  let notes: Repository<Note>;
  const suffix = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let admin: User;
  let member: User;
  let adminCookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    users = moduleRef.get(getRepositoryToken(User));
    notes = moduleRef.get(getRepositoryToken(Note));

    admin = await createUser('admin', UserRole.ADMIN);
    member = await createUser('member', UserRole.USER);
    adminCookie = await sessionFor(admin);
    memberCookie = await sessionFor(member);
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      // Primero las notas: created_by y updated_by referencian a los usuarios de prueba.
      await notes
        .createQueryBuilder()
        .delete()
        .where('created_by IN (:...ids) OR updated_by IN (:...ids)', {
          ids: userIds,
        })
        .execute();
      await users.delete(userIds);
    }
    await app.close();
  });

  async function createUser(label: string, role: UserRole): Promise<User> {
    const user = await users.save(
      users.create({
        name: `Prueba S3 ${label}`,
        email: `s3-${label}-${suffix}@test.local`,
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

  function call(method: Method, path: string, cookie?: string) {
    const req = request(app.getHttpServer())[method](`/api${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  async function createNote(
    body: object = { x: 100, y: 100 },
    cookie = adminCookie,
  ): Promise<NoteResponse> {
    return noteOf(await call('post', '/notes', cookie).send(body).expect(201));
  }

  async function listNotes(): Promise<NoteResponse[]> {
    const response = await call('get', '/notes', memberCookie).expect(200);
    return response.body as NoteResponse[];
  }

  describe('sin sesión', () => {
    it.each<[Method, string]>([
      ['get', '/notes'],
      ['post', '/notes'],
      ['put', `/notes/${MISSING_ID}`],
      ['patch', `/notes/${MISSING_ID}/position`],
      ['delete', `/notes/${MISSING_ID}`],
    ])('%s %s responde 401 UNAUTHORIZED', async (method, path) => {
      const response = await call(method, path).expect(401);

      expect(errorCode(response)).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/notes', () => {
    it('con solo la posición crea la nota con valores por defecto y registra al autor', async () => {
      const response = await call('post', '/notes', memberCookie)
        .send({ x: 120, y: 80 })
        .expect(201);

      expect(response.body).toEqual({
        note: {
          id: expect.any(String) as string,
          title: 'Nueva nota',
          body: '',
          status: 'pending',
          x: 120,
          y: 80,
          updatedAt: expect.any(String) as string,
        },
      });
      const stored = await notes.findOneByOrFail({ id: noteOf(response).id });
      expect(stored).toMatchObject({
        createdById: member.id,
        updatedById: member.id,
      });
    });

    it('guarda título (sin espacios sobrantes), texto, estado y posición en los límites del lienzo', async () => {
      const note = await createNote({
        title: '  Planificar sprint  ',
        body: 'Detalle',
        status: 'in_progress',
        x: BOARD_WIDTH,
        y: BOARD_HEIGHT,
      });

      expect(note).toMatchObject({
        title: 'Planificar sprint',
        body: 'Detalle',
        status: 'in_progress',
        x: BOARD_WIDTH,
        y: BOARD_HEIGHT,
      });
    });

    it.each([
      ['falta la posición', { title: 'Sin posición' }],
      ['x es negativa', { x: -1, y: 0 }],
      ['x queda fuera del lienzo', { x: BOARD_WIDTH + 1, y: 0 }],
      ['y no es entera', { x: 0, y: 10.5 }],
      ['la posición llega como texto', { x: '10', y: '10' }],
      ['el título está vacío', { title: '', x: 0, y: 0 }],
      ['el título tiene solo espacios', { title: '   ', x: 0, y: 0 }],
      [
        'el título supera 120 caracteres',
        { title: 'a'.repeat(121), x: 0, y: 0 },
      ],
      [
        'el texto supera 2000 caracteres',
        { body: 'a'.repeat(2001), x: 0, y: 0 },
      ],
      ['el estado no existe', { status: 'archived', x: 0, y: 0 }],
      ['incluye un campo no permitido', { x: 0, y: 0, createdBy: MISSING_ID }],
    ])('responde 422 VALIDATION_ERROR si %s', async (_case, body) => {
      const response = await call('post', '/notes', adminCookie)
        .send(body)
        .expect(422);

      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/notes', () => {
    it('devuelve las notas de todos los usuarios, solo con los campos públicos', async () => {
      const byAdmin = await createNote({ title: 'De admin', x: 10, y: 20 });
      const byMember = await createNote(
        { title: 'De usuario', x: 30, y: 40 },
        memberCookie,
      );

      const list = await listNotes();

      expect(list).toEqual(expect.arrayContaining([byAdmin, byMember]));
      for (const note of list) {
        expect(Object.keys(note).sort()).toEqual([
          'body',
          'id',
          'status',
          'title',
          'updatedAt',
          'x',
          'y',
        ]);
      }
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('actualiza solo el contenido: la posición no cambia y registra quién editó', async () => {
      const created = await createNote({ title: 'Original', x: 200, y: 300 });

      const response = await call('put', `/notes/${created.id}`, memberCookie)
        .send({ title: 'Editada', body: 'Nuevo texto', status: 'done' })
        .expect(200);

      const updated = noteOf(response);
      expect(updated).toEqual({
        ...created,
        title: 'Editada',
        body: 'Nuevo texto',
        status: 'done',
        updatedAt: expect.any(String) as string,
      });
      expect(Date.parse(String(updated.updatedAt))).toBeGreaterThan(
        Date.parse(String(created.updatedAt)),
      );
      await expect(
        notes.findOneByOrFail({ id: created.id }),
      ).resolves.toMatchObject({
        createdById: admin.id,
        updatedById: member.id,
      });
      expect(await listNotes()).toContainEqual(updated);
    });

    it.each([
      ['falta el estado', { title: 'T', body: '' }],
      ['falta el texto', { title: 'T', status: 'pending' }],
      [
        'el título tiene solo espacios',
        { title: ' ', body: '', status: 'pending' },
      ],
      [
        'incluye la posición',
        { title: 'T', body: '', status: 'done', x: 0, y: 0 },
      ],
    ])('responde 422 VALIDATION_ERROR si %s', async (_case, body) => {
      const { id } = await createNote();

      const response = await call('put', `/notes/${id}`, adminCookie)
        .send(body)
        .expect(422);

      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/notes/:id/position', () => {
    it('actualiza solo la posición: el contenido no cambia', async () => {
      const created = await createNote({
        title: 'Móvil',
        body: 'Texto',
        status: 'in_progress',
        x: 10,
        y: 10,
      });

      const response = await call(
        'patch',
        `/notes/${created.id}/position`,
        memberCookie,
      )
        .send({ x: 640, y: 450 })
        .expect(200);

      expect(noteOf(response)).toEqual({
        ...created,
        x: 640,
        y: 450,
        updatedAt: expect.any(String) as string,
      });
      await expect(
        notes.findOneByOrFail({ id: created.id }),
      ).resolves.toMatchObject({ x: 640, y: 450, updatedById: member.id });
    });

    it.each([
      ['falta y', { x: 10 }],
      ['y es negativa', { x: 10, y: -5 }],
      ['y queda fuera del lienzo', { x: 10, y: BOARD_HEIGHT + 1 }],
      ['x no es entera', { x: 1.5, y: 1 }],
      ['incluye contenido', { x: 1, y: 1, title: 'Cambio' }],
    ])('responde 422 VALIDATION_ERROR si %s', async (_case, body) => {
      const { id } = await createNote();

      const response = await call('patch', `/notes/${id}/position`, adminCookie)
        .send(body)
        .expect(422);

      expect(errorCode(response)).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('responde 204 sin cuerpo y la nota deja de existir', async () => {
      const { id } = await createNote();

      const response = await call('delete', `/notes/${id}`, adminCookie).expect(
        204,
      );

      expect(response.text).toBe('');
      expect((await listNotes()).map((note) => note.id)).not.toContain(id);
      await call('delete', `/notes/${id}`, adminCookie).expect(404);
    });
  });

  describe('rutas con :id', () => {
    it.each<[Method, (id: string) => string, object | undefined]>([
      ['put', (id) => `/notes/${id}`, { title: 'T', body: '', status: 'done' }],
      ['patch', (id) => `/notes/${id}/position`, { x: 1, y: 1 }],
      ['delete', (id) => `/notes/${id}`, undefined],
    ])(
      '%s responde 404 NOTE_NOT_FOUND con un id inexistente y 422 con un id que no es UUID',
      async (method, path, body) => {
        const send = (id: string) => {
          const req = call(method, path(id), adminCookie);
          return body ? req.send(body) : req;
        };

        const missing = await send(MISSING_ID).expect(404);
        const malformed = await send('no-es-un-uuid').expect(422);

        expect(errorCode(missing)).toBe('NOTE_NOT_FOUND');
        expect(errorCode(malformed)).toBe('VALIDATION_ERROR');
      },
    );
  });

  describe('tablero compartido', () => {
    it('un usuario con rol user edita, mueve y elimina una nota creada por un administrador', async () => {
      const { id } = await createNote(
        { title: 'Nota del admin', x: 50, y: 60 },
        adminCookie,
      );

      await call('put', `/notes/${id}`, memberCookie)
        .send({ title: 'Editada por usuario', body: '', status: 'done' })
        .expect(200);
      await call('patch', `/notes/${id}/position`, memberCookie)
        .send({ x: 70, y: 80 })
        .expect(200);
      await call('delete', `/notes/${id}`, memberCookie).expect(204);
    });
  });
});
