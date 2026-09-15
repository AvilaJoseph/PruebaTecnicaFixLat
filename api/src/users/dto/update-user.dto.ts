import { IsBoolean } from 'class-validator';
import { UserRole } from '../user.entity';
import {
  OptionalField,
  UserEmail,
  UserName,
  UserPassword,
  UserRoleField,
} from './user-fields';

/**
 * `PATCH /api/users/:id`: solo los campos que cambian. `password` restablece la contraseña;
 * `active: false` desactiva y `active: true` reactiva.
 */
export class UpdateUserDto {
  @OptionalField()
  @UserName()
  name?: string;

  @OptionalField()
  @UserEmail()
  email?: string;

  @OptionalField()
  @UserPassword()
  password?: string;

  @OptionalField()
  @UserRoleField()
  role?: UserRole;

  @OptionalField()
  @IsBoolean()
  active?: boolean;
}
