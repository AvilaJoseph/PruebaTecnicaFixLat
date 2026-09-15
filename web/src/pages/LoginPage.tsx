import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return 'Correo o contraseña incorrectos.';
      case 'USER_INACTIVE':
        return 'Tu usuario está inactivo. Pide a un administrador que lo reactive.';
      case 'VALIDATION_ERROR':
        return 'Introduce un correo electrónico válido y tu contraseña.';
      case 'NETWORK_ERROR':
        return error.message;
    }
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

export default function LoginPage() {
  const { user, loading, notice, clearNotice, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <p className="full-page-message" role="status">
        Cargando…
      </p>
    );
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/tablero'} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    clearNotice();
    setSubmitting(true);
    try {
      // Con el usuario ya en el contexto, este componente redirige en el siguiente render.
      await login(email, password);
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <form className="card login__card" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <h1>Portal de equipo</h1>
        <p className="muted">Inicia sesión para acceder al tablero y al dashboard.</p>

        {notice && (
          <p className="alert alert--info" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </main>
  );
}
