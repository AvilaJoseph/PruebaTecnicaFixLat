import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** Los correos se guardan en minúsculas: se normaliza antes de validar y buscar. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido' })
  @MaxLength(254)
  email: string;

  /** Límite superior para no gastar CPU de bcrypt con cuerpos enormes. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
