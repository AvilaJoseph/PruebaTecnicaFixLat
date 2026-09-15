import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { HttpErrorFilter } from './common/filters/http-error.filter';

/**
 * Configuración HTTP común: prefijo `/api`, cookies, validación de DTOs (`422`) y forma única
 * de errores. La aplican `main.ts` y los tests e2e para que ambos se comporten igual.
 */
export function setupApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 422,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  return app;
}
