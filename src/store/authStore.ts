import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { AppUser, AuthState } from '../types/user';

interface AuthStore extends AuthState {
  setUser: (user: AppUser | null) => void;
  setFirebaseUser: (firebaseUser: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ user: null, firebaseUser: null, loading: false, error: null }),
}));
