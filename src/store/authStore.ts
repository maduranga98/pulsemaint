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

// Role flags are stored as plain booleans and recomputed whenever the profile
// changes. They must NOT be object getters: zustand's set() merges state with
// Object.assign, which evaluates getters once and freezes their initial values
// as plain properties, so getter-based flags stop reflecting the loaded role.
function roleFlags(profile: UserProfile | null) {
  return {
    isAdmin: profile?.role === 'admin',
    isSupervisor: profile?.role === 'supervisor',
    isTechnician: profile?.role === 'technician',
    isStoreKeeper: profile?.role === 'store_keeper',
  };
}

export const useAuthStore = create<AuthStoreState & Selectors>((set, get) => ({
  user: null,
  userProfile: null,
  company: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  isAuthenticated: false,
  ...roleFlags(null),

  setUser: (user) => set({ user, isAuthenticated: user !== null }),
  setUserProfile: (profile) => set({ userProfile: profile, ...roleFlags(profile) }),
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
      isAuthenticated: false,
      ...roleFlags(null),
    }),

  hasRole: (role: UserRole) => {
    return get().userProfile?.role === role;
  },

  canAccess: (requiredRoles: UserRole[]) => {
    const userRole = get().userProfile?.role;
    return userRole ? requiredRoles.includes(userRole) : false;
  },
}));
