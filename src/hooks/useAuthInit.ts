import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { getCompanyIdFromUser } from '../lib/auth';
import type { CompanyProfile, UserProfile } from '../types/auth';

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

  // Live subscription to the user's own profile doc, so changes made by an
  // admin (e.g. reassigning a shift in Settings → Users) are reflected
  // immediately instead of requiring the user to log out and back in.
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setAuthLoading(true);

        profileUnsubscribeRef.current?.();
        profileUnsubscribeRef.current = null;

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

          // Get company ID. Right after signup, the /users/{uid} mapping
          // doc may still be in flight — registerCompany() writes it
          // AFTER createUserWithEmailAndPassword(), which is what
          // triggers this listener. Retry a few times so we don't
          // strand the OnboardingWizard on its loading gate.
          let companyId = await getCompanyIdFromUser(user.uid);
          for (let attempt = 0; !companyId && attempt < 6; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            companyId = await getCompanyIdFromUser(user.uid);
          }

          if (companyId) {
            let isFirstSnapshot = true;
            profileUnsubscribeRef.current = onSnapshot(
              doc(db, `companies/${companyId}/users/${user.uid}`),
              (userSnap) => {
                if (!userSnap.exists()) {
                  if (isFirstSnapshot && !useAuthStore.getState().userProfile) {
                    console.warn('User profile not found');
                  }
                  isFirstSnapshot = false;
                  return;
                }
                const userProfile = userSnap.data() as UserProfile;
                setUserProfile(userProfile);

                if (isFirstSnapshot) {
                  isFirstSnapshot = false;
                  // Keep the global mapping doc in sync so Firestore security
                  // rules always see the correct role and siteId. This
                  // self-heals existing users who have stale or null values
                  // in their mapping doc.
                  setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    companyId,
                    role: userProfile.role,
                    siteId: userProfile.siteIds[0] ?? companyId,
                  }, { merge: true }).catch(() => {});

                  const companyRef = doc(db, `companies/${companyId}`);
                  getDoc(companyRef).then((companySnap) => {
                    if (companySnap.exists()) {
                      setCompany(companySnap.data() as CompanyProfile);
                    }
                  }).catch(() => {});
                  // If company doc isn't readable yet, keep whatever the caller hydrated.
                }
              },
              (err) => {
                console.error('Failed to subscribe to user profile', err);
              },
            );
          } else if (!useAuthStore.getState().userProfile) {
            console.warn('Company ID not found for user');
          }
        } else {
          // User is signed out
          profileUnsubscribeRef.current?.();
          profileUnsubscribeRef.current = null;
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

    return () => {
      profileUnsubscribeRef.current?.();
      profileUnsubscribeRef.current = null;
      unsubscribe();
    };
  }, [setUser, setUserProfile, setCompany, setAuthLoading, setAuthInitialized, setError, reset]);

  return { isInitialized, isLoading };
}
