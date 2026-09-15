import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../users/user.entity';
import type { CreateNoteDto } from './dto/create-note.dto';
import type { UpdateNoteDto } from './dto/update-note.dto';
import type { UpdatePositionDto } from './dto/update-position.dto';
import { Note, NoteStatus } from './note.entity';

export const DEFAULT_NOTE_TITLE = 'Nueva nota';

/**
 * Notas del tablero único. No hay chequeo de autoría: cualquier usuario activo crea, edita,
 * mueve y elimina todas las notas; solo se registra quién creó y quién editó por última vez.
 * Ante ediciones simultáneas gana la última escritura.
 */
@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private readonly notes: Repository<Note>,
  ) {}

  /** De la más antigua a la más reciente: en la UI, las nuevas quedan por encima. */
  findAll(): Promise<Note[]> {
    return this.notes.find({ order: { createdAt: 'ASC', id: 'ASC' } });
  }

  create(dto: CreateNoteDto, author: User): Promise<Note> {
    return this.notes.save(
      this.notes.create({
        title: dto.title ?? DEFAULT_NOTE_TITLE,
        body: dto.body ?? '',
        status: dto.status ?? NoteStatus.PENDING,
        x: dto.x,
        y: dto.y,
        createdById: author.id,
        updatedById: author.id,
      }),
    );
  }

  /** Sustituye solo el contenido; la posición queda como esté en la BD. */
  updateContent(id: string, dto: UpdateNoteDto, editor: User): Promise<Note> {
    return this.updateColumns(id, {
      title: dto.title,
      body: dto.body,
      status: dto.status,
      updatedById: editor.id,
    });
  }

  /** Sustituye solo la posición; el contenido queda como esté en la BD. */
  updatePosition(
    id: string,
    dto: UpdatePositionDto,
    editor: User,
  ): Promise<Note> {
    return this.updateColumns(id, {
      x: dto.x,
      y: dto.y,
      updatedById: editor.id,
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.notes.delete({ id });
    if (!result.affected) {
      throw noteNotFound();
    }
  }

  /**
   * `UPDATE` de las columnas indicadas (y `updated_at`). No se usa `save()`: si otra petición
   * elimina la nota entre la lectura y la escritura, `save()` la volvería a insertar.
   */
  private async updateColumns(
    id: string,
    changes: Partial<
      Pick<Note, 'title' | 'body' | 'status' | 'x' | 'y' | 'updatedById'>
    >,
  ): Promise<Note> {
    const result = await this.notes.update({ id }, changes);
    const note = result.affected ? await this.notes.findOneBy({ id }) : null;
    if (!note) {
      throw noteNotFound();
    }
    return note;
  }
}

function noteNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOTE_NOT_FOUND',
    message: 'La nota no existe o fue eliminada',
  });
}
