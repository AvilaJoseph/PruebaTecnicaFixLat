import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  notesApi,
  type Note,
  type NoteContent,
  type NotePosition,
} from '../api/notes';
import NoteCard from '../components/NoteCard';

const NEW_NOTE_TITLE = 'Nueva nota';
/** Margen desde la esquina visible del tablero donde aparece una nota nueva. */
const NEW_NOTE_MARGIN = 40;
/** Desplazamiento entre notas nuevas consecutivas, para que no queden exactamente encima. */
const NEW_NOTE_STEP = 32;
/** Espacio reservado para que una nota nueva quepa entera dentro del lienzo. */
const NEW_NOTE_SIZE = { width: 260, height: 300 };

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.code === 'NETWORK_ERROR' ? error.message : fallback;
}

/**
 * Tablero único compartido: lienzo libre de tamaño fijo con desplazamiento. El contenido de cada
 * nota se confirma con Guardar; la posición se guarda sola al soltar (actualización optimista
 * que se revierte si la API falla).
 */
export default function BoardPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  // Apilado local (no se persiste): la última nota tocada queda por encima del resto.
  const [stackOrder, setStackOrder] = useState<Record<string, number>>({});
  const stackCounter = useRef(0);
  const topNoteId = useRef<string | null>(null);
  const createdCount = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadState({ status: 'loading' });
    try {
      setNotes(await notesApi.list(signal));
      setLoadState({ status: 'ready' });
    } catch (error) {
      if (!signal?.aborted) {
        setLoadState({
          status: 'error',
          message: errorMessage(error, 'No se pudieron cargar las notas.'),
        });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const bringToFront = useCallback((id: string) => {
    if (topNoteId.current === id) {
      return;
    }
    topNoteId.current = id;
    stackCounter.current += 1;
    const order = stackCounter.current;
    setStackOrder((current) => ({ ...current, [id]: order }));
  }, []);

  /** Otro usuario eliminó la nota: se quita del tablero y se avisa. */
  const dropMissingNote = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
    setNotice('Esa nota ya no existe: otro usuario la eliminó.');
  }, []);

  const saveContent = useCallback(
    async (id: string, content: NoteContent) => {
      try {
        const saved = await notesApi.updateContent(id, content);
        // Solo el contenido: la posición local puede ser más reciente que la de la respuesta.
        setNotes((current) =>
          current.map((note) =>
            note.id === id
              ? {
                  ...note,
                  title: saved.title,
                  body: saved.body,
                  status: saved.status,
                  updatedAt: saved.updatedAt,
                }
              : note,
          ),
        );
      } catch (error) {
        if (isNotFound(error)) {
          dropMissingNote(id);
        }
        throw error;
      }
    },
    [dropMissingNote],
  );

  const moveNote = useCallback(
    async (id: string, from: NotePosition, to: NotePosition) => {
      const placeAt = (position: NotePosition, onlyIfAt?: NotePosition) =>
        setNotes((current) =>
          current.map((note) =>
            note.id === id &&
            (!onlyIfAt || (note.x === onlyIfAt.x && note.y === onlyIfAt.y))
              ? { ...note, ...position }
              : note,
          ),
        );

      placeAt(to);
      try {
        await notesApi.updatePosition(id, to);
      } catch (error) {
        if (isNotFound(error)) {
          dropMissingNote(id);
          return;
        }
        // Se revierte solo si la nota no se ha vuelto a mover mientras tanto.
        placeAt(from, to);
        setNotice(
          errorMessage(error, 'No se pudo guardar la nueva posición; la nota volvió a su sitio.'),
        );
      }
    },
    [dropMissingNote],
  );

  const deleteNote = useCallback(async (id: string) => {
    try {
      await notesApi.remove(id);
    } catch (error) {
      // Si ya no existía, el resultado es el mismo que eliminarla.
      if (!isNotFound(error)) {
        throw error;
      }
    }
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  async function createNote() {
    const viewport = viewportRef.current;
    const step = (createdCount.current % 8) * NEW_NOTE_STEP;
    const x = Math.min(
      (viewport?.scrollLeft ?? 0) + NEW_NOTE_MARGIN + step,
      BOARD_WIDTH - NEW_NOTE_SIZE.width,
    );
    const y = Math.min(
      (viewport?.scrollTop ?? 0) + NEW_NOTE_MARGIN + step,
      BOARD_HEIGHT - NEW_NOTE_SIZE.height,
    );

    setCreating(true);
    setNotice(null);
    try {
      const note = await notesApi.create({
        title: NEW_NOTE_TITLE,
        x: Math.round(x),
        y: Math.round(y),
      });
      createdCount.current += 1;
      setNotes((current) => [...current, note]);
      bringToFront(note.id);
      setFocusNoteId(note.id);
    } catch (error) {
      setNotice(errorMessage(error, 'No se pudo crear la nota.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="board">
      <header className="board__toolbar">
        <div>
          <h1>Tablero</h1>
          <p className="muted board__hint">
            Arrastra las notas desde su cabecera. Los cambios de título, texto y estado se
            confirman con Guardar.
          </p>
        </div>
        <div className="board__actions">
          {loadState.status === 'ready' && (
            <span className="muted">
              {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
            </span>
          )}
          <button
            type="button"
            className="button button--primary"
            onClick={() => void createNote()}
            disabled={creating || loadState.status !== 'ready'}
          >
            {creating ? 'Creando…' : '+ Nueva nota'}
          </button>
        </div>
      </header>

      {notice && (
        <div className="alert alert--error board__notice" role="alert">
          <span>{notice}</span>
          <button
            type="button"
            className="board__notice-close"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {loadState.status === 'loading' && (
        <p className="muted" role="status">
          Cargando notas…
        </p>
      )}

      {loadState.status === 'error' && (
        <div className="alert alert--error board__notice" role="alert">
          <span>{loadState.message}</span>
          <button type="button" className="button button--secondary" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {loadState.status === 'ready' && (
        <div className="board__viewport" ref={viewportRef}>
          <div className="board__canvas" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
            {notes.length === 0 && (
              <p className="board__empty muted">
                El tablero está vacío. Pulsa «Nueva nota» para crear la primera.
              </p>
            )}
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                zIndex={stackOrder[note.id] ?? 0}
                autoFocus={note.id === focusNoteId}
                onActivate={bringToFront}
                onSave={saveContent}
                onMove={(id, from, to) => void moveNote(id, from, to)}
                onDelete={deleteNote}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
