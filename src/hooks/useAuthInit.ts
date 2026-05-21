import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { fetchUserProfile, getCompanyIdFromUser } from '../lib/auth';
import type { CompanyProfile } from '../types/auth';

export function useAuthInit() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useAuthStore((state) => state.setUser);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setCompany = useAuthStore((state) => state.setCompany);
  const setAuthLoading = useAuthStore((state) => state.setLoading);
  const setAuthInitialized = useAuthStore((state) => state.setInitialized);
  const setError = useAuthStore((state) => state.setError);
  const reset = useAuthStore((state) => state.reset);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setAuthLoading(true);

        if (user) {
          // User is signed in
          console.log('Auth state changed - user signed in:', user.uid);
          setUser(user);
          setError(null);

          // The /users/{uid} mapping doc may not exist yet right after
          // sign-up — registerCompany() writes it AFTER Firebase Auth
          // creates the credential that triggers this listener. In that
          // case we leave any profile/company the caller has already
          // hydrated into the store in place. We re-read store state
          // after every await so a concurrent hydration by RegisterPage
          // isn't clobbered by a stale capture.

          // Get company ID
          const companyId = await getCompanyIdFromUser(user.uid);

          if (companyId) {
            const userProfile = await fetchUserProfile(user.uid, companyId);

            if (userProfile) {
              setUserProfile(userProfile);

              const companyRef = doc(db, `companies/${companyId}`);
              const companySnap = await getDoc(companyRef);
              if (companySnap.exists()) {
                setCompany(companySnap.data() as CompanyProfile);
              }
              // If company doc isn't readable yet, keep whatever the caller hydrated.
            } else if (!useAuthStore.getState().userProfile) {
              console.warn('User profile not found');
            }
          } else if (!useAuthStore.getState().userProfile) {
            console.warn('Company ID not found for user');
          }
        } else {
          // User is signed out
          reset();
        }

        setAuthLoading(false);
        setAuthInitialized(true);
        setIsInitialized(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
        setAuthLoading(false);
        setAuthInitialized(true);
        setIsInitialized(true);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setUserProfile, setCompany, setAuthLoading, setAuthInitialized, setError, reset]);

  return { isInitialized, isLoading };
}
