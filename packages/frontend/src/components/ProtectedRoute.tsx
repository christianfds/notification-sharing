import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

export function routeForRole(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin';
    case UserRole.SECRETARY:
      return '/secretary';
    case UserRole.PASTOR:
      return '/pastor';
  }
}

interface ProtectedRouteProps {
  role: UserRole;
}

export default function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>Verificando sessão...</main>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== role) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
