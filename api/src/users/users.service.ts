import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './user.entity';

/** Las mismas rondas que usa la migración SeedDemoData. */
const BCRYPT_ROUNDS = 10;

/** `unique_violation` de PostgreSQL: en `users` solo puede venir del correo. */
const PG_UNIQUE_VIOLATION = '23505';

type UserChanges = Partial<
  Pick<User, 'name' | 'email' | 'role' | 'active' | 'passwordHash'>
>;

/**
 * Administración de usuarios. No se eliminan: se desactivan y reactivan.
 *
 * Regla: siempre queda al menos un administrador activo. Se aplica dentro de una transacción
 * que bloquea (`FOR UPDATE`) a los administradores activos, así dos peticiones simultáneas no
 * pueden desactivar o degradar a los dos últimos.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** Del más antiguo al más reciente: los nuevos aparecen al final de la tabla. */
  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'ASC', id: 'ASC' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    try {
      return await this.users.save(
        this.users.create({
          name: dto.name,
          email: dto.email,
          role: dto.role,
          active: true,
          passwordHash,
        }),
      );
    } catch (error) {
      throw isUniqueViolation(error) ? emailTaken() : error;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const changes: UserChanges = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.email !== undefined) changes.email = dto.email;
    if (dto.role !== undefined) changes.role = dto.role;
    if (dto.active !== undefined) changes.active = dto.active;
    if (dto.password !== undefined) {
      changes.passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        if (changes.role === UserRole.USER || changes.active === false) {
          await assertAnotherActiveAdminRemains(manager, id);
        }
        if (Object.keys(changes).length > 0) {
          await manager.update(User, { id }, changes);
        }
        const user = await manager.findOneBy(User, { id });
        if (!user) {
          throw new NotFoundException({
            code: 'USER_NOT_FOUND',
            message: 'El usuario no existe',
          });
        }
        return user;
      });
    } catch (error) {
      throw isUniqueViolation(error) ? emailTaken() : error;
    }
  }
}

/**
 * Se llama cuando el cambio deja al usuario sin ser administrador activo. Si ahora lo es y es el
 * único → `409 LAST_ADMIN`.
 *
 * El bloqueo, en orden de id para que dos transacciones no se bloqueen mutuamente, obliga a una
 * petición simultánea a esperar el `COMMIT` de esta; al continuar, PostgreSQL vuelve a evaluar el
 * `WHERE` y ya no cuenta al administrador que esta transacción desactivó o degradó.
 */
async function assertAnotherActiveAdminRemains(
  manager: EntityManager,
  id: string,
): Promise<void> {
  const activeAdmins = await manager
    .createQueryBuilder(User, 'u')
    .where('u.role = :role AND u.active = true', { role: UserRole.ADMIN })
    .orderBy('u.id')
    .setLock('pessimistic_write')
    .getMany();

  const isActiveAdmin = activeAdmins.some((admin) => admin.id === id);
  if (isActiveAdmin && activeAdmins.length === 1) {
    throw new ConflictException({
      code: 'LAST_ADMIN',
      message:
        'Debe quedar al menos un administrador activo: no se puede desactivar ni quitar el rol al último',
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

function emailTaken(): ConflictException {
  return new ConflictException({
    code: 'EMAIL_TAKEN',
    message: 'Ya existe un usuario con ese correo electrónico',
  });
}
