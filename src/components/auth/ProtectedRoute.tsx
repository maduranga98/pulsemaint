import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AuthLoading from './AuthLoading';
import { getDashboardRoute } from '../../lib/auth';
import type { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthenticated = useAuthStore((state) => state.user !== null);
  const userRole = useAuthStore((state) => state.userProfile?.role);
  const location = useLocation();

  if (!isInitialized) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    // Remember where the user was headed (e.g. a scanned machine QR deep
    // link) so login can return them there.
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (requiredRoles && userRole && !requiredRoles.includes(userRole)) {
    return <Navigate to="/app/unauthorized" replace />;
  }

  return <>{children}</>;
}

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isAuthenticated = useAuthStore((state) => state.user !== null);
  const userRole = useAuthStore((state) => state.userProfile?.role);
  const location = useLocation();

  if (!isInitialized) {
    return <AuthLoading />;
  }

  if (isAuthenticated && userRole) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? getDashboardRoute(userRole)} replace />;
  }

  return <>{children}</>;
}
