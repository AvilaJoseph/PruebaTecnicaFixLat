import { useCallback, useEffect, useState } from 'react';
import { userErrorMessage, usersApi } from '../api/users';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { ROLE_LABELS, type User } from '../auth/types';
import UserFormDialog from '../components/UserFormDialog';

interface Notice {
  kind: 'info' | 'error';
  text: string;
}

/** Formulario abierto: `user: null` crea un usuario nuevo. */
interface EditorState {
  user: User | null;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Administración de usuarios (solo administradores): listar, crear, editar, asignar rol y
 * desactivar o reactivar. Los usuarios no se eliminan.
 */
export default function UsersPage() {
  const currentUser = useCurrentUser();
  const { syncCurrentUser } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  /** Usuario cuyo estado se está cambiando. */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await usersApi.list(signal));
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setLoadError(userErrorMessage(error, 'No se pudo cargar la lista de usuarios.'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function replaceUser(updated: User) {
    setUsers((list) => list && list.map((user) => (user.id === updated.id ? updated : user)));
    // Si el administrador cambió su propia cuenta, la sesión se actualiza (o se cierra).
    syncCurrentUser(updated);
  }

  function openEditor(user: User | null) {
    setNotice(null);
    setEditor({ user });
  }

  function handleSaved(saved: User) {
    const created = editor?.user === null;
    setEditor(null);
    if (created) {
      setUsers((list) => list && [...list, saved]);
      setNotice({
        kind: 'info',
        text: `Usuario «${saved.name}» creado. Ya puede iniciar sesión con ${saved.email} y la contraseña inicial que definiste.`,
      });
    } else {
      setNotice({ kind: 'info', text: `Cambios de «${saved.name}» guardados.` });
      replaceUser(saved);
    }
  }

  async function toggleActive(user: User) {
    const deactivating = user.active;
    const isSelf = user.id === currentUser.id;
    const question = deactivating
      ? `¿Desactivar a «${user.name}»? No podrá iniciar sesión y, si tiene una sesión abierta, se cerrará en su siguiente acción.${
          isSelf ? ' Es tu propio usuario: saldrás de la aplicación.' : ''
        }`
      : `¿Reactivar a «${user.name}»? Podrá volver a iniciar sesión.`;
    if (!window.confirm(question)) {
      return;
    }

    setNotice(null);
    setPendingId(user.id);
    try {
      const updated = await usersApi.update(user.id, { active: !user.active });
      setNotice({
        kind: 'info',
        text: `Usuario «${updated.name}» ${deactivating ? 'desactivado' : 'reactivado'}.`,
      });
      replaceUser(updated);
    } catch (error) {
      setNotice({
        kind: 'error',
        text: userErrorMessage(error, 'No se pudo cambiar el estado del usuario.'),
      });
    } finally {
      setPendingId(null);
    }
  }

  const activeAdmins = users?.filter((user) => user.role === 'admin' && user.active).length ?? 0;

  return (
    <section className="users" aria-busy={loading}>
      <header className="users__toolbar">
        <div>
          <h1>Usuarios</h1>
          <p className="muted users__hint">
            Cada usuario creado aquí inicia sesión con su correo y la contraseña inicial que le
            asignes. Siempre debe quedar al menos un administrador activo.
          </p>
        </div>
        <button type="button" className="button button--primary" onClick={() => openEditor(null)}>
          Nuevo usuario
        </button>
      </header>

      {notice && (
        <p
          className={`alert alert--${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}

      {loadError && (
        <p className="alert alert--error" role="alert">
          {loadError}
          <button type="button" className="alert__action" onClick={() => void load()}>
            Reintentar
          </button>
        </p>
      )}

      {!users && loading && (
        <p className="muted" role="status">
          Cargando usuarios…
        </p>
      )}

      {users && (
        <>
          <div className="card table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  const pending = pendingId === user.id;
                  return (
                    <tr
                      key={user.id}
                      className={user.active ? undefined : 'users-table__row--inactive'}
                    >
                      <td className="users-table__name">
                        {user.name}
                        {isSelf && <span className="users-table__self">(tú)</span>}
                      </td>
                      <td className="users-table__email">{user.email}</td>
                      <td>
                        <span className={`badge badge--${user.role}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            user.active ? 'user-state' : 'user-state user-state--inactive'
                          }
                        >
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="users-table__actions">
                          <button
                            type="button"
                            className="button button--secondary button--small"
                            onClick={() => openEditor(user)}
                            disabled={pending}
                            aria-label={`Editar a ${user.name}`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={
                              user.active
                                ? 'button button--danger button--small'
                                : 'button button--secondary button--small'
                            }
                            onClick={() => void toggleActive(user)}
                            disabled={pending}
                            aria-label={`${user.active ? 'Desactivar' : 'Reactivar'} a ${user.name}`}
                          >
                            {user.active ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted users__summary">
            {plural(users.length, 'usuario', 'usuarios')} ·{' '}
            {plural(activeAdmins, 'administrador activo', 'administradores activos')}
          </p>
        </>
      )}

      {editor && (
        <UserFormDialog
          user={editor.user}
          isSelf={editor.user?.id === currentUser.id}
          onSaved={handleSaved}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}
