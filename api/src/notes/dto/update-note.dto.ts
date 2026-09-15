import { NoteStatus } from '../note.entity';
import { NoteBody, NoteStatusField, NoteTitle } from './note-fields';

/**
 * `PUT /api/notes/:id`: el contenido completo que confirma el botón Guardar. No admite la
 * posición (se rechaza con `422`), que tiene su propio endpoint.
 */
export class UpdateNoteDto {
  @NoteTitle()
  title: string;

  @NoteBody()
  body: string;

  @NoteStatusField()
  status: NoteStatus;
}
