import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { subscribeMyStaffRequests } from '@/services/staffRequests.service';
import type { StaffRequest } from '@/types/staffRequest';
import NewRequestModal from '../components/NewRequestModal';
import RequestList from '../components/RequestList';

/** Every non-admin role: raise requests and follow the replies. */
export default function MyRequestsPage() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!profile?.companyId || !profile.id) return;
    setLoading(true);
    return subscribeMyStaffRequests(
      profile.companyId,
      profile.id,
      (rows) => { setRequests(rows); setError(null); setLoading(false); },
      (msg) => { setError(msg); setLoading(false); },
    );
  }, [profile?.companyId, profile?.id]);

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#F0F4F8]">{t('common.staffRequests.myPage.title')}</h1>
          <p className="text-sm text-[#8BA3BF]">{t('common.staffRequests.myPage.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E4FC2]"
        >
          <Plus className="h-4 w-4" /> {t('common.staffRequests.myPage.newRequest')}
        </button>
      </div>

      <RequestList
        requests={requests}
        loading={loading}
        error={error}
        mode="requester"
        emptyText={t('common.staffRequests.myPage.empty')}
      />

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
