import { Navigate, Route, Routes } from 'react-router';
import AdminRoute from './auth/AdminRoute';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import AppLayout from './components/AppLayout';
import BoardPage from './pages/BoardPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Área autenticada: dashboard, tablero y administración. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/tablero" replace />} />
            <Route path="tablero" element={<BoardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route element={<AdminRoute />}>
              <Route path="admin/usuarios" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/tablero" replace />} />
      </Routes>
    </AuthProvider>
  );
}
