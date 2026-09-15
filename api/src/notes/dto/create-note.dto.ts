import { IsOptional } from 'class-validator';
import { NoteStatus } from '../note.entity';
import {
  NoteBody,
  NoteStatusField,
  NoteTitle,
  PositionX,
  PositionY,
} from './note-fields';

/** `POST /api/notes`: solo la posición es obligatoria; el resto toma valores por defecto. */
export class CreateNoteDto {
  @IsOptional()
  @NoteTitle()
  title?: string;

  @IsOptional()
  @NoteBody()
  body?: string;

  @IsOptional()
  @NoteStatusField()
  status?: NoteStatus;

  @PositionX()
  x: number;

  @PositionY()
  y: number;
}
