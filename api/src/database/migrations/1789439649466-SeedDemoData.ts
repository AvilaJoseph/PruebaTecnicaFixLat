import { hash } from 'bcryptjs';
import { MigrationInterface, QueryRunner } from 'typeorm';

const BCRYPT_ROUNDS = 10;

// Identificadores fijos: permiten que `down` retire exactamente lo que sembró `up`,
// aunque el equipo haya cambiado después el correo de las cuentas demo.
const DEMO_USERS = [
  {
    id: '0e1b3ca0-d42c-46fe-aac1-1ee8071c5acd',
    name: 'Administrador Demo',
    email: 'admin@demo.test',
    role: 'admin',
    passwordVariable: 'SEED_ADMIN_PASSWORD',
    defaultPassword: 'Admin123!',
  },
  {
    id: '8cfac845-3242-4b04-a984-9231df413c6d',
    name: 'Usuario Demo',
    email: 'usuario@demo.test',
    role: 'user',
    passwordVariable: 'SEED_USER_PASSWORD',
    defaultPassword: 'Usuario123!',
  },
] as const;

const DEMO_ADMIN_ID = DEMO_USERS[0].id;

const SAMPLE_NOTES = [
  {
    id: '096b577f-df84-4b2a-b1c3-803a5fead7a6',
    title: 'Bienvenida al tablero',
    body: 'Este es el tablero compartido del equipo. Arrastra las notas para reorganizarlas.',
    status: 'pending',
    x: 40,
    y: 40,
  },
  {
    id: 'ebfdba07-9acb-41ad-a1c8-6d196f5434e4',
    title: 'Preparar la demo',
    body: 'Repasar el inicio de sesión, el tablero y el dashboard.',
    status: 'in_progress',
    x: 320,
    y: 40,
  },
  {
    id: 'dd104af7-3842-4b5e-a06e-6ffc5d18703f',
    title: 'Entorno local listo',
    body: 'El entorno completo se levanta con docker compose.',
    status: 'done',
    x: 600,
    y: 40,
  },
  {
    id: 'a02729f9-40a2-45b9-9758-d54935abb00f',
    title: 'Revisar métricas',
    body: 'El dashboard muestra el total de notas y su distribución por estado.',
    status: 'pending',
    x: 40,
    y: 300,
  },
] as const;

/**
 * Cuentas demo y notas de ejemplo. Como toda migración, TypeORM la registra en la tabla
 * `migrations` y solo se aplica una vez por base de datos: reiniciar el entorno no vuelve a
 * crear usuarios ni notas. Los hashes bcrypt se calculan al ejecutarse, con las contraseñas
 * de SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD (o los valores demo por defecto).
 */
export class SeedDemoData1789439649466 implements MigrationInterface {
  name = 'SeedDemoData1789439649466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const user of DEMO_USERS) {
      const password =
        process.env[user.passwordVariable] || user.defaultPassword;
      const passwordHash = await hash(password, BCRYPT_ROUNDS);
      await queryRunner.query(
        `INSERT INTO "users" ("id", "name", "email", "password_hash", "role")
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.name, user.email, passwordHash, user.role],
      );
    }

    for (const note of SAMPLE_NOTES) {
      await queryRunner.query(
        `INSERT INTO "notes" ("id", "title", "body", "status", "pos_x", "pos_y", "created_by", "updated_by")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          note.id,
          note.title,
          note.body,
          note.status,
          note.x,
          note.y,
          DEMO_ADMIN_ID,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const userIds = DEMO_USERS.map((user) => user.id);

    await queryRunner.query(
      `DELETE FROM "notes" WHERE "id" = ANY($1::uuid[])`,
      [SAMPLE_NOTES.map((note) => note.id)],
    );
    // Las notas creadas después por las cuentas demo se conservan, sin autor.
    await queryRunner.query(
      `UPDATE "notes" SET "created_by" = NULL WHERE "created_by" = ANY($1::uuid[])`,
      [userIds],
    );
    await queryRunner.query(
      `UPDATE "notes" SET "updated_by" = NULL WHERE "updated_by" = ANY($1::uuid[])`,
      [userIds],
    );
    await queryRunner.query(
      `DELETE FROM "users" WHERE "id" = ANY($1::uuid[])`,
      [userIds],
    );
  }
}
