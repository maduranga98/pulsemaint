import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
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
 *
 * Loaded through the `listRequestRecipients` Cloud Function, because
 * technicians / trainees / floor operators can't read the company user
 * roster under firestore.rules. Falls back to the roster for roles that can,
 * if the function call fails.
 */
export function useEligibleRequestRecipients(): { recipients: CompanyUserOption[]; loading: boolean } {
  const profile = useAuthStore((s) => s.userProfile);
  const { users } = useCompanyUsers(profile?.companyId, { includeAdmins: true });
  const [remote, setRemote] = useState<CompanyUserOption[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    setLoading(true);
    httpsCallable<unknown, { recipients: Omit<CompanyUserOption, 'shiftId'>[] }>(functions, 'listRequestRecipients')({})
      .then((res) => {
        if (!cancelled) setRemote(res.data.recipients.map((r) => ({ ...r, shiftId: null })));
      })
      .catch((err) => {
        console.error('listRequestRecipients failed; using the roster instead', err);
        if (!cancelled) setRemote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const recipients = useMemo(() => {
    const allowed = recipientOptionsFor(profile?.role) as string[];
    const order = ['supervisor', 'plant_manager', 'admin'];
    const source = remote ?? users;
    return source
      .filter((u) => {
        if (u.id === profile?.id || !allowed.includes(u.role)) return false;
        if (u.role === 'admin') return true;
        if (u.plantId !== (profile?.plantId ?? null)) return false;
        return u.role === 'plant_manager' || sameDepartment(u.department, profile?.department);
      })
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.fullName.localeCompare(b.fullName));
  }, [remote, users, profile?.id, profile?.role, profile?.plantId, profile?.department]);

  return { recipients, loading };
}
