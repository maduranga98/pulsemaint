import { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface SuperadminState {
  /** Auth has resolved and the token's claims have been read. */
  ready: boolean;
  signedIn: boolean;
  isSuperadmin: boolean;
  email: string | null;
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
  const [state, setState] = useState({ ready: false, signedIn: false, isSuperadmin: false, email: null as string | null });

  useEffect(
    () =>
      onIdTokenChanged(auth, async (user) => {
        if (!user || user.isAnonymous) {
          setState({ ready: true, signedIn: false, isSuperadmin: false, email: null });
          return;
        }
        const token = await user.getIdTokenResult();
        setState({ ready: true, signedIn: true, isSuperadmin: token.claims.superadmin === true, email: user.email });
      }),
    [],
  );

  const refresh = useCallback(async () => {
    await auth.currentUser?.getIdToken(true);
  }, []);

  return { ...state, refresh };
}
