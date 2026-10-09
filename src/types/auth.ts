import type { Timestamp } from 'firebase/firestore';

export type UserRole =
  | 'admin'
  | 'plant_manager'
  | 'supervisor'
  | 'technician'
  | 'store_keeper'
  | 'hr_officer'
  | 'trainee'
  | 'floor_operator'
  | 'safety_officer';

export interface UserProfile {
  id: string;
  companyId: string;
  siteIds: string[];
  /** Plant this user is registered under (top-level, above department/site
   *  scoping). Null/omitted for admin, who is not plant-restricted. */
  plantId?: string | null;
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
  /**
   * Self-registered companies wait for a Lumora superadmin to approve them
   * before anyone can use the app. Missing on companies that predate
   * approvals — treat that as approved (see companyApproval()).
   */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  /** 'platform' when Lumora assigned the plan manually (e.g. Enterprise billed outside Stripe). */
  planSetBy?: string | null;
  /** Set when an admin asked to leave FirmiCore (requestCancellation). */
  leaveRequestedAt?: Timestamp | null;
  /** A Stripe-portal cancellation still waiting for the admin's reason. */
  cancellationReasonPendingId?: string | null;
  rejectionReason?: string | null;
  trialEndsAt: Timestamp | null;
  /** Why access is paused — set by Cloud Functions only. */
  suspendedReason?: 'payment_failed' | 'trial_expired' | 'subscription_ended' | null;
  /** A charge failed; cleared when a payment succeeds. */
  paymentFailed?: boolean;
  paymentFailureMessage?: string | null;
  paymentFailedAt?: Timestamp | null;
  plan: 'starter' | 'workshop' | 'factory' | 'enterprise';
  /** Set by the stripeWebhook Cloud Function only — never written by clients. */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Timestamp | null;
  /** Cancelled in Stripe, still active until currentPeriodEnd. */
  cancelAtPeriodEnd?: boolean;
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
  /** Terms of Service version accepted at registration, and when/by whom. */
  termsVersion?: string;
  termsAcceptedAt?: Timestamp | null;
  termsAcceptedBy?: string;
  /** Latest Terms acceptance given when adding a card or subscribing (written by Cloud Functions). */
  billingTermsVersion?: string;
  billingTermsAcceptedAt?: Timestamp | null;
  billingTermsAcceptedBy?: string;
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
  /** Plant this invited user will be registered under. Null for admin. */
  plantId?: string | null;
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
