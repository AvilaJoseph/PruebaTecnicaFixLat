import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LambdaClient } from '@aws-sdk/client-lambda';

/** Token de inyección del cliente de Lambda (los tests lo sustituyen por un doble). */
export const LAMBDA_CLIENT = Symbol('LAMBDA_CLIENT');

/**
 * Mismo código en local y en AWS: con `LAMBDA_ENDPOINT` el cliente habla con el emulador RIE
 * del contenedor `metrics-lambda`; vacío, con el endpoint real de Lambda y el rol IAM.
 */
export const lambdaClientProvider: Provider = {
  provide: LAMBDA_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new LambdaClient({
      region: config.getOrThrow<string>('AWS_REGION'),
      endpoint: config.get<string>('LAMBDA_ENDPOINT') || undefined,
      // Si la Lambda no responde, el dashboard muestra el error pronto en lugar de esperar
      // a los tres reintentos por defecto.
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 2_000, requestTimeout: 15_000 },
    }),
};
