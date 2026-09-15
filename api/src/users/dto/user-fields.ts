import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../user.entity';

export const USER_NAME_MAX_LENGTH = 120;
export const USER_EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
/** El mismo máximo que acepta el login (`LoginDto`): una contraseña más larga nunca serviría. */
export const PASSWORD_MAX_LENGTH = 128;

/*
 * Reglas de cada campo, compartidas por los DTOs de crear y editar. La web usa las mismas
 * cifras (`web/src/api/users.ts`).
 */

/** Nombre sin espacios sobrantes; uno formado solo por espacios cuenta como vacío. */
export const UserName = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    Length(1, USER_NAME_MAX_LENGTH),
  );

/** Los correos se guardan en minúsculas (igual que los normaliza el login). */
export const UserEmail = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: 'email debe ser un correo electrónico válido' }),
    MaxLength(USER_EMAIL_MAX_LENGTH),
  );

/** Se guarda tal cual la escribe el administrador: sin recortar espacios. */
export const UserPassword = () =>
  applyDecorators(IsString(), Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH));

export const UserRoleField = () => applyDecorators(IsEnum(UserRole));

/**
 * Campo opcional que, si llega, debe ser válido. A diferencia de `@IsOptional()`, no deja pasar
 * `null`: todas las columnas de `users` son `NOT NULL`.
 */
export const OptionalField = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
