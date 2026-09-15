import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import type { User } from './types';

const SESSION_ENDED_NOTICE = 'Sesión finalizada o usuario inactivo. Vuelve a iniciar sesión.';
const SELF_DEACTIVATED_NOTICE =
  'Desactivaste tu propio usuario. Otro administrador debe reactivarlo para que puedas volver a entrar.';

interface AuthContextValue {
  /** Usuario autenticado; `null` si no hay sesión. */
  user: User | null;
  /** `true` mientras se comprueba la sesión inicial con `/auth/me`. */
  loading: boolean;
  /** Aviso para la pantalla de login (p. ej. la sesión expiró o el usuario fue desactivado). */
  notice: string | null;
  clearNotice: () => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /**
   * Aplica a la sesión un usuario recién editado desde la administración si es el autenticado:
   * un cambio de rol se refleja al instante y desactivarse a sí mismo cierra la sesión.
   */
  syncCurrentUser: (updated: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  // Copia síncrona para el manejador global de 401, que se ejecuta fuera del render.
  const userRef = useRef<User | null>(null);

  const setUser = useCallback((next: User | null) => {
    userRef.current = next;
    setUserState(next);
  }, []);

  // Sesión inicial. En una visita anónima el 401 es lo normal: no dispara el manejador global.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ user: User }>('/auth/me', {
        signal: controller.signal,
        skipUnauthorizedHandler: true,
      })
      .then((response) => setUser(response.user))
      .catch(() => {
        if (!controller.signal.aborted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [setUser]);

  // Cualquier 401 con una sesión abierta (expirada, usuario desactivado o eliminado) la cierra;
  // ProtectedRoute redirige entonces a /login, que muestra el aviso.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!userRef.current) {
        return;
      }
      setUser(null);
      setNotice(SESSION_ENDED_NOTICE);
    });
    return () => setUnauthorizedHandler(null);
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      // El login muestra su propio error: sus 401 no deben tratarse como sesión finalizada.
      const response = await api.post<{ user: User }>(
        '/auth/login',
        { email, password },
        { skipUnauthorizedHandler: true },
      );
      setNotice(null);
      setUser(response.user);
      return response.user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { skipUnauthorizedHandler: true });
    } catch {
      // Aunque la API no responda o la sesión ya no sea válida, se sale igualmente en la UI.
    } finally {
      setNotice(null);
      setUser(null);
    }
  }, [setUser]);

  const syncCurrentUser = useCallback(
    (updated: User) => {
      if (userRef.current?.id !== updated.id) {
        return;
      }
      if (!updated.active) {
        // La API ya rechaza la cookie; ProtectedRoute redirige a /login con el aviso.
        setUser(null);
        setNotice(SELF_DEACTIVATED_NOTICE);
        return;
      }
      setUser(updated);
    },
    [setUser],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, notice, clearNotice, login, logout, syncCurrentUser }),
    [user, loading, notice, clearNotice, login, logout, syncCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}

/** Usuario autenticado en páginas bajo `ProtectedRoute`, donde siempre existe. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) {
    throw new Error('useCurrentUser requiere una sesión (usar bajo <ProtectedRoute>)');
  }
  return user;
}
