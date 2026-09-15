import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  // Prefijo /api, cookie-parser, ValidationPipe y HttpErrorFilter globales (ver setup-app.ts).
  const app = setupApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(`API escuchando en el puerto ${port}`, 'Bootstrap');
}

void bootstrap();
