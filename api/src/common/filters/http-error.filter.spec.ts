import {
  ArgumentsHost,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter';

function createHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const request = { method: 'GET', originalUrl: '/api/prueba' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpErrorFilter', () => {
  const filter = new HttpErrorFilter();

  function expectError(
    exception: unknown,
    status: number,
    code: string,
    message: string,
  ) {
    const { host, response } = createHost();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ error: { code, message } });
  }

  afterEach(() => jest.restoreAllMocks());

  it('conserva el code y el message propios de la excepción', () => {
    expectError(
      new ConflictException({
        code: 'LAST_ADMIN',
        message: 'Debe quedar un administrador activo',
      }),
      409,
      'LAST_ADMIN',
      'Debe quedar un administrador activo',
    );
  });

  it('asigna un code por defecto según el estado HTTP', () => {
    expectError(new NotFoundException(), 404, 'NOT_FOUND', 'Not Found');
  });

  it('une los mensajes de validación en un solo texto', () => {
    expectError(
      new UnprocessableEntityException([
        'title must be a string',
        'property foo should not exist',
      ]),
      422,
      'VALIDATION_ERROR',
      'title must be a string; property foo should not exist',
    );
  });

  it('acepta excepciones cuya respuesta es solo texto', () => {
    expectError(
      new HttpException('Soy una tetera', 418),
      418,
      'HTTP_418',
      'Soy una tetera',
    );
  });

  it('conserva el estado 4xx de los errores públicos de middlewares de Express', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });
    expectError(tooLarge, 413, 'PAYLOAD_TOO_LARGE', 'request entity too large');
  });

  it('responde 500 INTERNAL_ERROR sin exponer el error original', () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    expectError(
      new Error('detalle interno'),
      500,
      'INTERNAL_ERROR',
      'Error interno del servidor',
    );
    expect(logError).toHaveBeenCalled();
  });
});
