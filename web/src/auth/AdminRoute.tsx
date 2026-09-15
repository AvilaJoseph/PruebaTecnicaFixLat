import { Navigate, Outlet } from 'react-router';
import { useCurrentUser } from './AuthContext';

/** Rutas de administración (va dentro de ProtectedRoute): el rol `user` vuelve al tablero. */
export default function AdminRoute() {
  const user = useCurrentUser();

  if (user.role !== 'admin') {
    return <Navigate to="/tablero" replace />;
  }

  return <Outlet />;
}
