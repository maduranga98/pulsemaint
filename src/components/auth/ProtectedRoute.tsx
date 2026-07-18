import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AuthLoading from './AuthLoading';
import { getDashboardRoute } from '../../lib/auth';
import {
  consumePostLoginRedirect,
  peekPostLoginRedirect,
  savePostLoginRedirect,
} from '../../lib/scanTarget';
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
    // link) so login can return them there. Persisted in sessionStorage too,
    // because router state does not survive page reloads during login.
    const from = `${location.pathname}${location.search}`;
    savePostLoginRedirect(from);
    return <Navigate to={redirectTo} replace state={{ from }} />;
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
    // Peek (don't consume) during render: the auth store updates several
    // times in a row while a login settles, so this branch can render more
    // than once before a <Navigate> commits. Consuming here would let an
    // early, discarded render eat the redirect and send a later render to
    // the dashboard instead of the scanned deep link.
    const from =
      (location.state as { from?: string } | null)?.from ?? peekPostLoginRedirect();
    return <RedirectAuthedUser to={from ?? getDashboardRoute(userRole)} />;
  }

  return <>{children}</>;
}

function RedirectAuthedUser({ to }: { to: string }) {
  // Clear the stored redirect only once this navigation actually commits.
  useEffect(() => {
    consumePostLoginRedirect();
  }, []);
  return <Navigate to={to} replace />;
}
