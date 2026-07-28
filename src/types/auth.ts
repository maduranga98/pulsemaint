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
  address: string | null;
  shiftId?: string | null;
  status: 'active' | 'inactive' | 'pending';
  loginMethod: 'email' | 'phone' | 'pin' | 'google';
  hasPin: boolean;
  mustChangePinOnLogin: boolean;
  profilePhoto: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp | null;
  invitedBy: string | null;
  /** Trainee-only: training period, set at registration. Preset is 6/12 months or 'custom'. */
  trainingPeriodPreset?: 6 | 12 | 'custom' | null;
  trainingStartDate?: Timestamp | null;
  trainingEndDate?: Timestamp | null;
}

export interface CompanyProfile {
  id: string;
  name: string;
  tradeName: string | null;
  industry: string;
  country: string;
  logoUrl: string | null;
  /** Data URL captured at upload time — avoids a cross-origin fetch of Storage's
   *  download URL (often blocked by CORS) when embedding the logo in generated
   *  PDFs like service letters. */
  logoDataUrl?: string | null;
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
  /** Shown on the letterhead of generated documents (service letters, PO
   * exports) and the company profile — a short "about the company" blurb. */
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Defaults to 'monthly' on legacy companies. */
  billingCycle?: 'monthly' | 'yearly';
  paymentMethods?: PaymentMethod[];
}

export interface PaymentMethod {
  id: string;
  brand: 'Visa' | 'Mastercard' | 'Amex' | 'Other';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  isDefault: boolean;
}

export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  employeeId: string | null;
  phone: string | null;
  address: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
  invitedByName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt: Timestamp | null;
  acceptedUserId: string | null;
  /** Trainee-only: training period, set at registration. Preset is 6/12 months or 'custom'. */
  trainingPeriodPreset?: 6 | 12 | 'custom' | null;
  trainingStartDate?: Timestamp | null;
  trainingEndDate?: Timestamp | null;
}

export interface AuthState {
  user: import('firebase/auth').User | null;
  userProfile: UserProfile | null;
  company: CompanyProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}
