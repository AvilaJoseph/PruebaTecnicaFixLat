import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NoteStatus } from '../note.entity';

/**
 * Tamaño del lienzo en píxeles: la posición `(x, y)` es la esquina superior izquierda de la
 * nota y debe caer dentro de él. La web usa las mismas cifras (`web/src/api/notes.ts`).
 */
export const BOARD_WIDTH = 4000;
export const BOARD_HEIGHT = 3000;

export const NOTE_TITLE_MAX_LENGTH = 120;
export const NOTE_BODY_MAX_LENGTH = 2000;

/*
 * Reglas de cada campo, compartidas por los DTOs de crear y editar. Cada DTO decide si el
 * campo es obligatorio (`@IsOptional()`).
 */

/** Título sin espacios sobrantes; uno formado solo por espacios cuenta como vacío. */
export const NoteTitle = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    Length(1, NOTE_TITLE_MAX_LENGTH),
  );

export const NoteBody = () =>
  applyDecorators(IsString(), MaxLength(NOTE_BODY_MAX_LENGTH));

export const NoteStatusField = () => applyDecorators(IsEnum(NoteStatus));

export const PositionX = () =>
  applyDecorators(IsInt(), Min(0), Max(BOARD_WIDTH));

export const PositionY = () =>
  applyDecorators(IsInt(), Min(0), Max(BOARD_HEIGHT));
