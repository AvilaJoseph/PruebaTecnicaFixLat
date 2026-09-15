import { UserRole } from '../user.entity';
import {
  UserEmail,
  UserName,
  UserPassword,
  UserRoleField,
} from './user-fields';

/**
 * `POST /api/users`. La contraseña es la inicial: con ella y el correo inicia sesión el nuevo
 * usuario. Siempre se crea activo (`active` no se admite: `422`).
 */
export class CreateUserDto {
  @UserName()
  name: string;

  @UserEmail()
  email: string;

  @UserPassword()
  password: string;

  @UserRoleField()
  role: UserRole;
}
