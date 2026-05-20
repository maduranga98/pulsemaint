import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser, UserRole } from '../types/user';

interface UseAuthResult {
  loading: boolean;
  error: string | null;
  signup: (email: string, password: string, userData: Partial<AppUser>) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuthActions(): UseAuthResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (email: string, password: string, userData: Partial<AppUser>) => {
    try {
      setLoading(true);
      setError(null);

      // Create Firebase Auth user
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      // Create Firestore user document
      const appUser: AppUser = {
        uid: user.uid,
        email: user.email || email,
        displayName: userData.displayName || '',
        role: userData.role || 'floor_operator',
        siteId: userData.siteId || '',
        siteName: userData.siteName || '',
        avatarUrl: null,
        phoneNumber: null,
        fcmTokens: [],
        whatsappNumber: null,
        isActive: true,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      await setDoc(doc(db, 'users', user.uid), appUser);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMsg);
      setLoading(false);
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      setError(errorMsg);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut(auth);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMsg);
      setLoading(false);
      throw err;
    }
  };

  return { loading, error, signup, login, logout };
}
