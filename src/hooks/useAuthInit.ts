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

          // Get company ID
          const companyId = await getCompanyIdFromUser(user.uid);
          console.log('Company ID retrieved:', companyId);

          if (companyId) {
            // Fetch user profile
            const userProfile = await fetchUserProfile(user.uid, companyId);
            console.log('User profile loaded:', userProfile);

            if (userProfile) {
              setUserProfile(userProfile);

              // Fetch company profile
              const companyRef = doc(db, `companies/${companyId}`);
              const companySnap = await getDoc(companyRef);
              if (companySnap.exists()) {
                const companyProfile = companySnap.data() as CompanyProfile;
                console.log('Company profile loaded:', companyProfile);
                setCompany(companyProfile);
              }
            } else {
              console.warn('User profile not found');
              setUserProfile(null);
              setCompany(null);
            }
          } else {
            console.warn('Company ID not found for user');
            setUserProfile(null);
            setCompany(null);
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
