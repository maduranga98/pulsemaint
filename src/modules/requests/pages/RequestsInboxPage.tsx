import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';
import { subscribeRequestInbox } from '@/services/staffRequests.service';
import type { StaffRequest, StaffRequestRecipientRole } from '@/types/staffRequest';
import { REQUEST_HANDLER_ROLES } from '@/types/staffRequest';
import RequestList from '../components/RequestList';

/**
 * Supervisor / plant manager / admin: requests addressed to them.
 * Supervisors see their own plant + department's, plant managers their own
 * plant's, admins every admin-addressed request (or the selected plant tab's).
 */
export default function RequestsInboxPage() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const { plantId } = useDepartmentScope();
  const role = profile?.role as StaffRequestRecipientRole | undefined;
  const isHandler = !!role && REQUEST_HANDLER_ROLES.includes(role);

  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.companyId || !role || !isHandler) return;
    setLoading(true);
    return subscribeRequestInbox(
      {
        companyId: profile.companyId,
        role,
        plantId: role === 'admin' ? plantId : profile.plantId ?? null,
        department: profile.department ?? null,
      },
      (rows) => { setRequests(rows); setError(null); setLoading(false); },
      (msg) => { setError(msg); setLoading(false); },
    );
  }, [profile?.companyId, profile?.plantId, profile?.department, role, isHandler, plantId]);

  const scopeKey =
    role === 'supervisor' ? 'supervisor' : role === 'plant_manager' ? 'plantManager' : 'admin';

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-[#F0F4F8]">{t('common.staffRequests.inbox.title')}</h1>
        <p className="text-sm text-[#8BA3BF]">
          {t(`common.staffRequests.inbox.scope.${scopeKey}`, {
            department: profile?.department ?? '—',
          })}
        </p>
      </div>
      <RequestList
        requests={requests}
        loading={loading}
        error={error}
        mode="handler"
        emptyText={t('common.staffRequests.inbox.empty')}
      />
    </div>
  );
}
