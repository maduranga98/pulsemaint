import type { Timestamp } from 'firebase/firestore';

export type UserRole =
  | 'admin'
  | 'plant_manager'
  | 'supervisor'
  | 'technician'
  | 'store_keeper'
  | 'hr_officer'
  | 'trainee'
  | 'floor_operator';

export interface UserProfile {
  id: string;
  companyId: string;
  siteIds: string[];
  role: UserRole;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
  status: 'active' | 'inactive' | 'pending';
  loginMethod: 'email' | 'phone' | 'pin' | 'google';
  hasPin: boolean;
  mustChangePinOnLogin: boolean;
  profilePhoto: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp | null;
  invitedBy: string | null;
}

export interface CompanyProfile {
  id: string;
  name: string;
  tradeName: string | null;
  industry: string;
  country: string;
  logoUrl: string | null;
  language: string;
  timezone: string;
  currency: 'LKR' | 'USD' | 'AED' | 'SAR';
  status: 'active' | 'trial' | 'suspended';
  trialEndsAt: Timestamp | null;
  plan: 'starter' | 'workshop' | 'factory' | 'enterprise';
  tenantId: string;
  createdAt: Timestamp;
  adminUserId: string;
  onboardingCompletedAt: Timestamp | null;
}

export interface AuthState {
  user: import('firebase/auth').User | null;
  userProfile: UserProfile | null;
  company: CompanyProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}
