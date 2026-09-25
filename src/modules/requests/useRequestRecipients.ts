import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCompanyUsers, type CompanyUserOption } from '@/hooks/useCompanyUsers';
import { sameDepartment } from '@/hooks/useRecordPlantMatcher';
import { recipientOptionsFor, type StaffRequest, type StaffRequestRecipientRole } from '@/types/staffRequest';

/**
 * Resolves who a request addressed to a role group actually reaches, for
 * notifications: supervisors of the request's plant + department, plant
 * managers of its plant, or every admin.
 */
export function useRequestRecipients() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { users } = useCompanyUsers(companyId, { includeAdmins: true });

  return useCallback(
    (
      req: Pick<StaffRequest, 'plantId' | 'department' | 'recipientUserId'> & { recipientRole: StaffRequestRecipientRole },
    ): string[] =>
      req.recipientUserId
        ? [req.recipientUserId]
        : users
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

/**
 * People the signed-in user may send a request to, by name: supervisors of
 * their own plant + department, plant managers of their own plant, and the
 * company's admins — limited to the roles their own role may address.
 */
export function useEligibleRequestRecipients(): CompanyUserOption[] {
  const profile = useAuthStore((s) => s.userProfile);
  const { users } = useCompanyUsers(profile?.companyId, { includeAdmins: true });
  return useMemo(() => {
    const allowed = recipientOptionsFor(profile?.role) as string[];
    const order = ['supervisor', 'plant_manager', 'admin'];
    return users
      .filter((u) => {
        if (u.id === profile?.id || !allowed.includes(u.role)) return false;
        if (u.role === 'admin') return true;
        if (u.plantId !== (profile?.plantId ?? null)) return false;
        return u.role === 'plant_manager' || sameDepartment(u.department, profile?.department);
      })
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.fullName.localeCompare(b.fullName));
  }, [users, profile?.id, profile?.role, profile?.plantId, profile?.department]);
}
