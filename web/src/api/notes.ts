import { api } from './client';

export type NoteStatus = 'pending' | 'in_progress' | 'done';

/** Forma `note` de la API (§5.3). */
export interface Note {
  id: string;
  title: string;
  body: string;
  status: NoteStatus;
  x: number;
  y: number;
  updatedAt: string;
}

/** Lo que confirma el botón Guardar. */
export type NoteContent = Pick<Note, 'title' | 'body' | 'status'>;

/** Lo que se guarda automáticamente al soltar la nota. */
export type NotePosition = Pick<Note, 'x' | 'y'>;

export const NOTE_STATUSES: readonly NoteStatus[] = ['pending', 'in_progress', 'done'];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecho',
};

/** Límites que valida la API (`api/src/notes/dto/note-fields.ts`). */
export const BOARD_WIDTH = 4000;
export const BOARD_HEIGHT = 3000;
export const NOTE_TITLE_MAX_LENGTH = 120;
export const NOTE_BODY_MAX_LENGTH = 2000;

export const notesApi = {
  list: (signal?: AbortSignal) => api.get<Note[]>('/notes', { signal }),

  create: async (input: Partial<NoteContent> & NotePosition) =>
    (await api.post<{ note: Note }>('/notes', input)).note,

  updateContent: async (id: string, content: NoteContent) =>
    (await api.put<{ note: Note }>(`/notes/${id}`, content)).note,

  updatePosition: async (id: string, position: NotePosition) =>
    (await api.patch<{ note: Note }>(`/notes/${id}/position`, position)).note,

  remove: (id: string) => api.delete(`/notes/${id}`),
};
