import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Variables de entorno de la API. Se validan al arrancar: si falta una obligatoria o
 * tiene un formato inválido, la aplicación no inicia.
 *
 * No se usa `enableImplicitConversion`: convertiría "false" en `true` (Boolean('false')).
 * Cada conversión es explícita.
 */
export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  /** Nombre de la Lambda de métricas (`function` con el emulador RIE local). */
  @IsOptional()
  @IsString()
  METRICS_FUNCTION_NAME?: string;

  /** Endpoint de la API de Lambda; vacío = endpoint real de AWS. */
  @IsOptional()
  @IsString()
  LAMBDA_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  AWS_REGION: string = 'us-east-1';
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .map(
        (error) =>
          `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Variables de entorno inválidas → ${details}`);
  }

  return env;
}

/** "true"/"false" (sin distinguir mayúsculas) → booleano; vacío → false; otro valor → sin cambios. */
function parseBoolean(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false' || normalized === '') {
    return false;
  }
  return value;
}
