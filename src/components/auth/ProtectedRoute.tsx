import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AuthLoading from './AuthLoading';
import { getDashboardRoute } from '../../lib/auth';
import { consumePostLoginRedirect, peekPostLoginRedirect } from '../../lib/scanTarget';
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
  const hasProfile = useAuthStore((state) => state.userProfile !== null);
  const userRole = useAuthStore((state) => state.userProfile?.role);
  const location = useLocation();

  if (!isInitialized) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    // Remember where the user was headed, via router state only — this
    // covers same-session redirects (e.g. a session that expired mid-visit).
    // We deliberately do NOT persist this to sessionStorage here: this
    // branch fires for every role-gated route a signed-out visitor hits
    // (a stale tab, an old bookmark, a shared device), and there is no way
    // to know yet whether the account that eventually logs in even has
    // access to that route. Blindly honoring it bounced technician/trainee/
    // store_keeper straight to "Access Denied" after a perfectly valid
    // login, whenever their browser had a leftover URL for a page their
    // role can't reach. The sessionStorage-backed redirect (surviving a
    // full page reload) is reserved for the one flow that legitimately
    // needs it — the QR scan deep link, saved explicitly by
    // ScanRedirectPage — so that one still works after this change.
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={redirectTo} replace state={{ from }} />;
  }

  if (requiredRoles) {
    // isInitialized flips true as soon as Firebase Auth resolves, which is
    // before the separate, async users/{uid} profile snapshot has
    // necessarily delivered its first result — so right after a legitimate
    // login there's a real window where isAuthenticated is true but
    // userProfile is still null. Keep waiting through that window
    // (AuthLoading) rather than treating "no role yet" as "wrong role" and
    // bouncing a valid login to Unauthorized before its profile has even
    // arrived. Routes with no requiredRoles don't need this wait — they're
    // open to any authenticated user regardless of role.
    if (!hasProfile) {
      return <AuthLoading />;
    }

    // Once the profile has actually loaded, a role that's missing
    // (malformed/incomplete users/{uid} doc) or doesn't match must be
    // denied like any other wrong role, not waved through. (A prior version
    // of this check only redirected when userRole was truthy AND excluded,
    // which let a missing role bypass every role-gated route in the app
    // instead of blocking it.)
    if (!(userRole && requiredRoles.includes(userRole))) {
      // Arrived here straight from the login page via a remembered
      // "where you were headed" URL — typically the page the *previous*
      // user of this browser was on when they signed out (e.g. an admin
      // page, then a store keeper logs in). That's not a page this user
      // asked for, so land them on their own dashboard rather than
      // showing Access Denied right after a valid login.
      if ((location.state as { postLogin?: boolean } | null)?.postLogin) {
        return <Navigate to={userRole ? getDashboardRoute(userRole) : '/login'} replace />;
      }
      return <Navigate to="/app/unauthorized" replace />;
    }
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
  return <Navigate to={to} replace state={{ postLogin: true }} />;
}
