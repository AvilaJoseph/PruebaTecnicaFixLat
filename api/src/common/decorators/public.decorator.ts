import { SetMetadata } from '@nestjs/common';

/** Metadato que consulta el guard global de autenticación para no exigir sesión. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta (o un controlador completo) como pública: accesible sin sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
