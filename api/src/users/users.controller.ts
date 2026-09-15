import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse, type UserResponse } from './user-response';
import { UsersService } from './users.service';

/** Un `:id` que no es UUID es un error de validación (`422`), igual que un cuerpo inválido. */
const userIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

/** Administración de usuarios: solo administradores (`403` para el rol `user`). */
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserResponse[]> {
    const users = await this.usersService.findAll();
    return users.map(toUserResponse);
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<{ user: UserResponse }> {
    const user = await this.usersService.create(dto);
    return { user: toUserResponse(user) };
  }

  @Patch(':id')
  async update(
    @Param('id', userIdPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<{ user: UserResponse }> {
    const user = await this.usersService.update(id, dto);
    return { user: toUserResponse(user) };
  }
}
