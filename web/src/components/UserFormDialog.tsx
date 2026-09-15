import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  userErrorMessage,
  usersApi,
  type UpdateUserInput,
} from '../api/users';
import { ROLE_LABELS, type User, type UserRole } from '../auth/types';

interface UserFormDialogProps {
  /** Usuario a editar; `null` para crear uno nuevo. */
  user: User | null;
  /** El administrador se está editando a sí mismo. */
  isSelf: boolean;
  onSaved: (user: User) => void;
  onClose: () => void;
}

interface FormValues {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

const ROLES: readonly UserRole[] = ['user', 'admin'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormValues, creating: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim() === '') {
    errors.name = 'El nombre es obligatorio.';
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Introduce un correo electrónico válido.';
  }
  // Al editar, una contraseña vacía significa "no cambiarla".
  if ((creating || values.password !== '') && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return errors;
}

/** Solo lo que cambió respecto al usuario guardado. */
function changesFor(user: User, values: FormValues): UpdateUserInput {
  const changes: UpdateUserInput = {};
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (name !== user.name) changes.name = name;
  if (email !== user.email) changes.email = email;
  if (values.role !== user.role) changes.role = values.role;
  if (values.password !== '') changes.password = values.password;
  return changes;
}

/**
 * Formulario modal para crear o editar un usuario: nombre, correo, rol y contraseña. El estado
 * activo/inactivo se cambia desde la tabla.
 */
export default function UserFormDialog({ user, isSelf, onSaved, onClose }: UserFormDialogProps) {
  const creating = user === null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [values, setValues] = useState<FormValues>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'user',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // En StrictMode el efecto se ejecuta dos veces: showModal() falla si ya está abierto.
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function change(changes: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...changes }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const errors = validate(values, creating);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      if (creating) {
        onSaved(
          await usersApi.create({
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
            password: values.password,
            role: values.role,
          }),
        );
        return;
      }
      const changes = changesFor(user, values);
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      onSaved(await usersApi.update(user.id, changes));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: 'Ya existe un usuario con ese correo electrónico.' });
      } else {
        setFormError(userErrorMessage(error, 'No se pudo guardar el usuario. Inténtalo de nuevo.'));
      }
      setSubmitting(false);
    }
  }

  const losesAdmin = isSelf && user?.role === 'admin' && values.role === 'user';

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={`${id}-title`}
      // Escape: no se cierra mientras se guarda.
      onCancel={(event) => {
        if (submitting) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <h2 id={`${id}-title`}>{creating ? 'Nuevo usuario' : 'Editar usuario'}</h2>

        {formError && (
          <p className="alert alert--error" role="alert">
            {formError}
          </p>
        )}

        <label className="field">
          <span>Nombre</span>
          <input
            name="name"
            value={values.name}
            maxLength={USER_NAME_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => change({ name: event.target.value })}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name ? `${id}-name-error` : undefined}
            autoFocus
          />
          {fieldErrors.name && (
            <span id={`${id}-name-error`} className="field__error">
              {fieldErrors.name}
            </span>
          )}
        </label>

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            name="email"
            value={values.email}
            maxLength={USER_EMAIL_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => change({ email: event.target.value })}
            aria-invalid={fieldErrors.email !== undefined}
            aria-describedby={fieldErrors.email ? `${id}-email-error` : undefined}
          />
          {fieldErrors.email && (
            <span id={`${id}-email-error`} className="field__error">
              {fieldErrors.email}
            </span>
          )}
        </label>

        <label className="field">
          <span>Rol</span>
          <select
            name="role"
            value={values.role}
            onChange={(event) => change({ role: event.target.value as UserRole })}
            aria-describedby={`${id}-role-hint`}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <span id={`${id}-role-hint`} className={losesAdmin ? 'field__error' : 'field__hint'}>
            {losesAdmin
              ? 'Perderás el acceso a la administración de usuarios.'
              : 'Los administradores, además del tablero y el dashboard, gestionan usuarios.'}
          </span>
        </label>

        <label className="field">
          <span>{creating ? 'Contraseña inicial' : 'Nueva contraseña'}</span>
          <input
            type="password"
            name="password"
            value={values.password}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            onChange={(event) => change({ password: event.target.value })}
            aria-invalid={fieldErrors.password !== undefined}
            aria-describedby={`${id}-password-hint`}
          />
          <span
            id={`${id}-password-hint`}
            className={fieldErrors.password ? 'field__error' : 'field__hint'}
          >
            {fieldErrors.password ??
              (creating
                ? `Mínimo ${PASSWORD_MIN_LENGTH} caracteres. El usuario iniciará sesión con su correo y esta contraseña.`
                : 'Déjala vacía para no cambiarla.')}
          </span>
        </label>

        <div className="dialog__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? 'Guardando…' : creating ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
