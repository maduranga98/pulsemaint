import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './breakdown';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  siteId: string;
  siteName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  fcmTokens: string[];
  whatsappNumber: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuthState {
  user: AppUser | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  error: string | null;
}
