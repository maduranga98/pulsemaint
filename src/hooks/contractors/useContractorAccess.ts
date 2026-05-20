import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types/auth';

export function useContractorAccess() {
  const role = useAuthStore((state) => state.userProfile?.role);

  const hasAny = (roles: UserRole[]) => Boolean(role && roles.includes(role));

  return {
    role,
    canReadRegistry: hasAny(['supervisor', 'plant_manager', 'admin']),
    canReadCompliance: hasAny(['hr_officer', 'supervisor', 'plant_manager', 'admin']),
    canManageContractors: hasAny(['supervisor', 'plant_manager', 'admin']),
    canManageDocuments: hasAny(['supervisor', 'plant_manager', 'admin']),
    canManageTechnicians: hasAny(['supervisor', 'plant_manager', 'admin']),
    canDeactivateOrBlacklist: hasAny(['plant_manager', 'admin']),
    canViewFinancials: hasAny(['plant_manager', 'admin']),
    canLogContractorWork: hasAny(['supervisor', 'admin']),
    canLogContractorParts: hasAny(['store_keeper', 'admin']),
    canRateContractor: hasAny(['supervisor', 'plant_manager', 'admin']),
    canApproveInvoice: hasAny(['plant_manager', 'admin']),
    isAdmin: role === 'admin',
  };
}
