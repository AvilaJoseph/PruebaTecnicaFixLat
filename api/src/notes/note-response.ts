import type { Note, NoteStatus } from './note.entity';

/** Forma pública de una nota (§5.3). */
export interface NoteResponse {
  id: string;
  title: string;
  body: string;
  status: NoteStatus;
  x: number;
  y: number;
  updatedAt: Date;
}

/** Serialización explícita: copia solo los campos públicos, aunque la entidad traiga más. */
export function toNoteResponse(note: Note): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    status: note.status,
    x: note.x,
    y: note.y,
    updatedAt: note.updatedAt,
  };
}
