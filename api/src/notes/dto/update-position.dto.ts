import { PositionX, PositionY } from './note-fields';

/** `PATCH /api/notes/:id/position`: solo la posición; el contenido no se admite (`422`). */
export class UpdatePositionDto {
  @PositionX()
  x: number;

  @PositionY()
  y: number;
}
