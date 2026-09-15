import { MigrationInterface, QueryRunner } from 'typeorm';

/** Esquema inicial: tipos enumerados y tablas `users` y `notes`. */
export class InitialSchema1789439648466 implements MigrationInterface {
  name = 'InitialSchema1789439648466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "note_status" AS ENUM ('pending', 'in_progress', 'done')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"          varchar(120) NOT NULL,
        "email"         varchar(254) NOT NULL UNIQUE,
        "password_hash" text NOT NULL,
        "role"          "user_role" NOT NULL DEFAULT 'user',
        "active"        boolean NOT NULL DEFAULT true,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notes" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"      varchar(120) NOT NULL,
        "body"       text NOT NULL DEFAULT '',
        "status"     "note_status" NOT NULL DEFAULT 'pending',
        "pos_x"      integer NOT NULL DEFAULT 40 CHECK ("pos_x" >= 0),
        "pos_y"      integer NOT NULL DEFAULT 40 CHECK ("pos_y" >= 0),
        "created_by" uuid REFERENCES "users" ("id"),
        "updated_by" uuid REFERENCES "users" ("id"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notes"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "note_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
