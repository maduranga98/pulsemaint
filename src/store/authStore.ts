import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { AuthState, CompanyProfile, UserProfile, UserRole } from '../types/auth';

interface AuthStoreState extends AuthState {
  setUser: (user: User | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setCompany: (company: CompanyProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

interface Selectors {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isTechnician: boolean;
  isStoreKeeper: boolean;
  hasRole: (role: UserRole) => boolean;
  canAccess: (requiredRoles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthStoreState & Selectors>((set, get) => ({
  user: null,
  userProfile: null,
  company: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setCompany: (company) => set({ company }),
  setLoading: (loading) => set({ isLoading: loading }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      user: null,
      userProfile: null,
      company: null,
      isLoading: false,
      error: null,
    }),

  get isAuthenticated() {
    return get().user !== null;
  },

  get isAdmin() {
    return get().userProfile?.role === 'admin';
  },

  get isSupervisor() {
    return get().userProfile?.role === 'supervisor';
  },

  get isTechnician() {
    return get().userProfile?.role === 'technician';
  },

  get isStoreKeeper() {
    return get().userProfile?.role === 'store_keeper';
  },

  hasRole: (role: UserRole) => {
    return get().userProfile?.role === role;
  },

  canAccess: (requiredRoles: UserRole[]) => {
    const userRole = get().userProfile?.role;
    return userRole ? requiredRoles.includes(userRole) : false;
  },
}));
