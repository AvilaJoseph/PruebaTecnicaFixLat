import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { ApiError } from '../api/client';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  NOTE_BODY_MAX_LENGTH,
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  NOTE_TITLE_MAX_LENGTH,
  type Note,
  type NoteContent,
  type NotePosition,
  type NoteStatus,
} from '../api/notes';

interface NoteCardProps {
  note: Note;
  /** Orden de apilado local; la nota que se arrastra queda siempre encima. */
  zIndex: number;
  /** Enfoca y selecciona el título al montar (nota recién creada). */
  autoFocus: boolean;
  /** El usuario tocó o enfocó la nota: el tablero la sube al frente. */
  onActivate: (id: string) => void;
  /** Rechaza si no se pudo guardar; la tarjeta muestra el error y conserva el borrador. */
  onSave: (id: string, content: NoteContent) => Promise<void>;
  /** Se llama al soltar si la posición cambió; el tablero la guarda y revierte si falla. */
  onMove: (id: string, from: NotePosition, to: NotePosition) => void;
  /** Rechaza si no se pudo eliminar. */
  onDelete: (id: string) => Promise<void>;
}

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string };

interface DragState {
  pointerId: number;
  /** Distancia entre el puntero y la esquina de la nota al empezar, para que no "salte". */
  offsetX: number;
  offsetY: number;
  from: NotePosition;
  current: NotePosition;
}

const SAVED_FEEDBACK_MS = 2000;
const DRAGGING_Z_INDEX = 1_000_000;

function contentOf(note: Note): NoteContent {
  return { title: note.title, body: note.body, status: note.status };
}

function sameContent(a: NoteContent, b: NoteContent): boolean {
  return a.title === b.title && a.body === b.body && a.status === b.status;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR') {
      return error.message;
    }
    if (error.code === 'VALIDATION_ERROR') {
      return 'Revisa los campos: el título es obligatorio.';
    }
  }
  return fallback;
}

/**
 * Nota tipo post-it con posición absoluta en el lienzo.
 *
 * - El contenido se edita directamente sobre la nota en un borrador local y solo se envía con
 *   **Guardar** (o Enter en el título).
 * - Se arrastra únicamente desde la cabecera, así los campos nunca inician un arrastre. Mover la
 *   nota no toca el borrador: los cambios sin guardar se conservan.
 */
export default function NoteCard({
  note,
  zIndex,
  autoFocus,
  onActivate,
  onSave,
  onMove,
  onDelete,
}: NoteCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  /** Contenido editado sin guardar; `null` mientras se muestra lo guardado. */
  const [draft, setDraft] = useState<NoteContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [deleting, setDeleting] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  /** Posición mostrada durante el arrastre, en lugar de la de `note`. */
  const [dragPosition, setDragPosition] = useState<NotePosition | null>(null);

  useEffect(() => {
    if (autoFocus) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (saveState.status !== 'saved') {
      return;
    }
    const timer = setTimeout(() => setSaveState({ status: 'idle' }), SAVED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [saveState]);

  const saved = contentOf(note);
  const shown = draft ?? saved;
  const dirty = draft !== null && !sameContent(draft, saved);
  const titleValid = shown.title.trim() !== '';
  const saving = saveState.status === 'saving';

  function edit(changes: Partial<NoteContent>) {
    setDraft({ ...shown, ...changes });
    if (saveState.status === 'saved' || saveState.status === 'error') {
      setSaveState({ status: 'idle' });
    }
  }

  function discard() {
    setDraft(null);
    setSaveState({ status: 'idle' });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !dirty || !titleValid || saving) {
      return;
    }
    const submitted = draft;
    setSaveState({ status: 'saving' });
    try {
      await onSave(note.id, { ...submitted, title: submitted.title.trim() });
      // Si se siguió escribiendo durante el guardado, ese borrador más reciente se conserva.
      setDraft((current) => (current === submitted ? null : current));
      setSaveState({ status: 'saved' });
    } catch (error) {
      setSaveState({
        status: 'error',
        message: actionErrorMessage(error, 'No se pudo guardar. Inténtalo de nuevo.'),
      });
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `¿Eliminar la nota «${note.title}»? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    try {
      // Si se elimina, el tablero desmonta esta tarjeta.
      await onDelete(note.id);
    } catch (error) {
      setDeleting(false);
      setSaveState({
        status: 'error',
        message: actionErrorMessage(error, 'No se pudo eliminar la nota.'),
      });
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    // Solo el botón principal; el botón Eliminar de la cabecera no inicia arrastre.
    if (event.button !== 0 || !card || (event.target as Element).closest('button')) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = card.getBoundingClientRect();
    const position = { x: note.x, y: note.y };
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      from: position,
      current: position,
    };
    setDragPosition(position);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const card = cardRef.current;
    const canvas = card?.offsetParent;
    if (!drag || drag.pointerId !== event.pointerId || !card || !(canvas instanceof HTMLElement)) {
      return;
    }
    // Relativo al lienzo en cada movimiento: sigue siendo correcto si el tablero se desplaza.
    const canvasRect = canvas.getBoundingClientRect();
    drag.current = {
      x: clamp(
        Math.round(event.clientX - canvasRect.left - drag.offsetX),
        0,
        Math.min(BOARD_WIDTH, canvas.clientWidth - card.offsetWidth),
      ),
      y: clamp(
        Math.round(event.clientY - canvasRect.top - drag.offsetY),
        0,
        Math.min(BOARD_HEIGHT, canvas.clientHeight - card.offsetHeight),
      ),
    };
    setDragPosition(drag.current);
  }

  /** Al soltar se guarda la posición; si el navegador cancela el arrastre, la nota vuelve. */
  function finishDrag(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const { from, current: to } = drag;
    // En el mismo lote que la actualización optimista del tablero: la nota no parpadea.
    setDragPosition(null);
    if (commit && (to.x !== from.x || to.y !== from.y)) {
      onMove(note.id, from, to);
    }
  }

  const dragging = dragPosition !== null;
  const position = dragPosition ?? note;

  let stateText = '';
  let stateModifier = '';
  if (saveState.status === 'error') {
    stateText = saveState.message;
    stateModifier = 'error';
  } else if (saveState.status === 'saved') {
    stateText = 'Guardado';
  } else if (dirty && !titleValid) {
    stateText = 'El título es obligatorio';
    stateModifier = 'error';
  } else if (dirty && !saving) {
    stateText = 'Cambios sin guardar';
    stateModifier = 'dirty';
  }

  const classes = ['note', `note--${shown.status}`];
  if (dirty) classes.push('note--dirty');
  if (dragging) classes.push('note--dragging');

  return (
    <article
      ref={cardRef}
      className={classes.join(' ')}
      style={{
        left: position.x,
        top: position.y,
        zIndex: dragging ? DRAGGING_Z_INDEX : zIndex,
      }}
      onPointerDownCapture={() => onActivate(note.id)}
      onFocusCapture={() => onActivate(note.id)}
      aria-label={`Nota: ${note.title}`}
    >
      <div
        className="note__handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={(event) => finishDrag(event, false)}
        title="Arrastra para mover la nota"
      >
        <span className="note__grip" aria-hidden="true">
          ⠿⠿
        </span>
        <button
          type="button"
          className="note__delete"
          onClick={() => void remove()}
          disabled={deleting || saving}
          aria-label="Eliminar nota"
          title="Eliminar nota"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm4 2v8h1.5v-8H10Zm3.5 0v8H15v-8h-1.5Z"
            />
          </svg>
        </button>
      </div>

      <form className="note__form" onSubmit={(event) => void save(event)} noValidate>
        <input
          ref={titleRef}
          className="note__title"
          value={shown.title}
          maxLength={NOTE_TITLE_MAX_LENGTH}
          onChange={(event) => edit({ title: event.target.value })}
          placeholder="Título"
          aria-label="Título"
          aria-invalid={!titleValid}
        />
        <textarea
          className="note__body"
          value={shown.body}
          maxLength={NOTE_BODY_MAX_LENGTH}
          onChange={(event) => edit({ body: event.target.value })}
          placeholder="Escribe el texto de la nota…"
          aria-label="Texto"
          rows={4}
        />
        <select
          className="note__status"
          value={shown.status}
          onChange={(event) => edit({ status: event.target.value as NoteStatus })}
          aria-label="Estado"
        >
          {NOTE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {NOTE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <div className="note__footer">
          <span
            className={
              stateModifier
                ? `note__state note__state--${stateModifier}`
                : 'note__state'
            }
            role="status"
          >
            {stateText}
          </span>
          {dirty && (
            <button
              type="button"
              className="button button--link button--small"
              onClick={discard}
              disabled={saving}
            >
              Descartar
            </button>
          )}
          <button
            type="submit"
            className="button button--primary button--small"
            disabled={!dirty || !titleValid || saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </article>
  );
}
