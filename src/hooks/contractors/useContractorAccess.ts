import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/auth';

export function useContractorAccess() {
  const role = useAuthStore((state) => state.userProfile?.role);

  const hasAny = (roles: UserRole[]) => Boolean(role && roles.includes(role));

  // HR officers own the contractor registry and are granted admin-level access
  // across the Contractors tab (read, manage, financials, ratings, sign-off).
  return {
    role,
    canReadRegistry: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canReadCompliance: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canManageContractors: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canManageDocuments: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canManageTechnicians: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canDeactivateOrBlacklist: hasAny(['hr_officer', 'plant_manager', 'admin']),
    canViewFinancials: hasAny(['hr_officer', 'plant_manager', 'admin']),
    canLogContractorWork: hasAny(['hr_officer', 'supervisor', 'admin']),
    canLogContractorParts: hasAny(['store_keeper', 'admin']),
    canRateContractor: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canApproveInvoice: hasAny(['hr_officer', 'plant_manager', 'admin']),
    isAdmin: role === 'admin',
  };
}
