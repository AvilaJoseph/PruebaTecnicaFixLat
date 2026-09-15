import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { ROLE_LABELS } from '../auth/types';

/** Estructura del área autenticada: menú según el rol, usuario actual y botón Salir. */
export default function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav__link nav__link--active' : 'nav__link';

  async function handleLogout() {
    setLoggingOut(true);
    // Al quedar sin usuario, ProtectedRoute desmonta este layout y redirige a /login.
    await logout();
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Portal de equipo</span>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/tablero" className={navClass}>
            Tablero
          </NavLink>
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/admin/usuarios" className={navClass}>
              Usuarios
            </NavLink>
          )}
        </nav>
        <div className="session">
          <span className="session__name" title={user.email}>
            {user.name}
          </span>
          <span className={`badge badge--${user.role}`}>{ROLE_LABELS[user.role]}</span>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            Salir
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
