import { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface SuperadminState {
  /** Auth has resolved and the token's claims have been read. */
  ready: boolean;
  signedIn: boolean;
  isSuperadmin: boolean;
  /** Sales manager: custom claim `salesManager` — sees only the sales part of the console. */
  isSalesManager: boolean;
  email: string | null;
  uid: string | null;
  /** Force a fresh ID token (after the superadmin claim is granted). */
  refresh: () => Promise<void>;
}

/**
 * Lumora Ventures superadmin = Firebase Auth custom claim `superadmin: true`
 * (set by the platformClaimSuperadmin / platformSetSuperadmin functions).
 * Read from the ID token, so it is also what Firestore rules and the
 * platform callables check.
 */
export function useSuperadmin(): SuperadminState {
  const [state, setState] = useState({ ready: false, signedIn: false, isSuperadmin: false, isSalesManager: false, email: null as string | null, uid: null as string | null });

  useEffect(
    () =>
      onIdTokenChanged(auth, async (user) => {
        if (!user || user.isAnonymous) {
          setState({ ready: true, signedIn: false, isSuperadmin: false, isSalesManager: false, email: null, uid: null });
          return;
        }
        const token = await user.getIdTokenResult();
        setState({ ready: true, signedIn: true, isSuperadmin: token.claims.superadmin === true, isSalesManager: token.claims.salesManager === true, email: user.email, uid: user.uid });
      }),
    [],
  );

  const refresh = useCallback(async () => {
    await auth.currentUser?.getIdToken(true);
  }, []);

  return { ...state, refresh };
}

/** True for a sales manager (not a superadmin): they get the trimmed, personal versions of the sales pages. */
export function useSalesOnly(): { salesOnly: boolean; uid: string | null } {
  const { isSalesManager, isSuperadmin, uid } = useSuperadmin();
  return { salesOnly: isSalesManager && !isSuperadmin, uid };
}
