import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { toNoteResponse, type NoteResponse } from './note-response';
import { NotesService } from './notes.service';

/** Un `:id` que no es UUID es un error de validación (`422`), igual que un cuerpo inválido. */
const noteIdPipe = new ParseUUIDPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

/**
 * Tablero único compartido. Todas las rutas exigen sesión (guard global) y ninguna comprueba
 * rol ni autoría.
 */
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  async findAll(): Promise<NoteResponse[]> {
    const notes = await this.notesService.findAll();
    return notes.map(toNoteResponse);
  }

  @Post()
  async create(
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: User,
  ): Promise<{ note: NoteResponse }> {
    const note = await this.notesService.create(dto, user);
    return { note: toNoteResponse(note) };
  }

  /** Título, texto y estado: lo que confirma el botón Guardar. */
  @Put(':id')
  async updateContent(
    @Param('id', noteIdPipe) id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: User,
  ): Promise<{ note: NoteResponse }> {
    const note = await this.notesService.updateContent(id, dto, user);
    return { note: toNoteResponse(note) };
  }

  /** Posición: la web la guarda automáticamente al soltar la nota. */
  @Patch(':id/position')
  async updatePosition(
    @Param('id', noteIdPipe) id: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() user: User,
  ): Promise<{ note: NoteResponse }> {
    const note = await this.notesService.updatePosition(id, dto, user);
    return { note: toNoteResponse(note) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', noteIdPipe) id: string): Promise<void> {
    await this.notesService.remove(id);
  }
}
