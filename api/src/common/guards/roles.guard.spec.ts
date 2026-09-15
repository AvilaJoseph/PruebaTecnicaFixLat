import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User, UserRole } from '../../users/user.entity';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class MixedController {
  @Roles('admin')
  adminOnly() {}

  anyUser() {}
}

@Roles('admin')
class AdminController {
  list() {}
}

function contextFor(
  controller: new () => object,
  handler: string,
  user?: Pick<User, 'role'>,
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () =>
      (controller.prototype as Record<string, () => void>)[handler],
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('rechaza con 403 FORBIDDEN a un usuario con rol user en una ruta @Roles("admin")', () => {
    const context = contextFor(MixedController, 'adminOnly', {
      role: UserRole.USER,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });

  it('permite a un administrador una ruta @Roles("admin")', () => {
    expect(
      guard.canActivate(
        contextFor(MixedController, 'adminOnly', { role: UserRole.ADMIN }),
      ),
    ).toBe(true);
  });

  it('permite cualquier rol en rutas sin @Roles', () => {
    expect(
      guard.canActivate(
        contextFor(MixedController, 'anyUser', { role: UserRole.USER }),
      ),
    ).toBe(true);
  });

  it('aplica @Roles declarado a nivel de controlador', () => {
    expect(() =>
      guard.canActivate(
        contextFor(AdminController, 'list', { role: UserRole.USER }),
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        contextFor(AdminController, 'list', { role: UserRole.ADMIN }),
      ),
    ).toBe(true);
  });

  it('rechaza una ruta con roles si la petición no trae usuario', () => {
    expect(() =>
      guard.canActivate(contextFor(MixedController, 'adminOnly')),
    ).toThrow(ForbiddenException);
  });
});
