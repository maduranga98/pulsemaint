import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { sameDepartment } from '@/hooks/useRecordPlantMatcher';
import type { StaffRequest, StaffRequestRecipientRole } from '@/types/staffRequest';

/**
 * Resolves who a request addressed to a role group actually reaches, for
 * notifications: supervisors of the request's plant + department, plant
 * managers of its plant, or every admin.
 */
export function useRequestRecipients() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { users } = useCompanyUsers(companyId, { includeAdmins: true });

  return useCallback(
    (req: Pick<StaffRequest, 'plantId' | 'department'> & { recipientRole: StaffRequestRecipientRole }): string[] =>
      users
        .filter((u) => {
          if (u.role !== req.recipientRole) return false;
          if (req.recipientRole === 'admin') return true;
          if (u.plantId !== req.plantId) return false;
          return req.recipientRole === 'plant_manager' || sameDepartment(u.department, req.department);
        })
        .map((u) => u.id),
    [users],
  );
}
