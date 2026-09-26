import { useEffect, useMemo, useState } from 'react';
import { Plus, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { subscribeMyStaffRequests } from '@/services/staffRequests.service';
import { subscribeMyRecordGrants } from '@/services/recordAccessGrants.service';
import { isGrantActive } from '@/lib/recordAccess';
import type { StaffRequest } from '@/types/staffRequest';
import type { RecordAccessGrant } from '@/types/recordAccessGrant';
import NewRequestModal from '../components/NewRequestModal';
import RequestList from '../components/RequestList';
import SharedRecordsPanel from '../components/SharedRecordsPanel';
import { MyGrantsContext } from '../myGrantsContext';
import { useNow } from '../useNow';

/** Every non-admin role: raise requests and follow the replies. */
export default function MyRequestsPage() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.userProfile);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [grants, setGrants] = useState<RecordAccessGrant[]>([]);
  const now = useNow();

  // Work orders / breakdowns shared with me through record_access requests.
  useEffect(() => {
    if (!profile?.companyId || !profile.id) return;
    return subscribeMyRecordGrants(profile.companyId, profile.id, setGrants, (msg) => console.error(msg));
  }, [profile?.companyId, profile?.id]);
  const activeGrants = useMemo(() => grants.filter((g) => isGrantActive(g, now)), [grants, now]);
  const subjectByRequest = useMemo(() => new Map(requests.map((r) => [r.id, r.subject])), [requests]);

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

      {activeGrants.length > 0 && (
        <section className="space-y-2 rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#F0F4F8]">
            <Share2 className="h-4 w-4 text-[#34D399]" /> {t('common.staffRequests.records.sharedWithMe')}
          </h2>
          <p className="text-xs text-[#8BA3BF]">{t('common.staffRequests.records.sharedWithMeHint')}</p>
          <SharedRecordsPanel grants={activeGrants} mode="viewer" showRequestSubject={(g) => subjectByRequest.get(g.requestId)} />
        </section>
      )}

      <MyGrantsContext.Provider value={grants}>
        <RequestList
          requests={requests}
          loading={loading}
          error={error}
          mode="requester"
          emptyText={t('common.staffRequests.myPage.empty')}
        />
      </MyGrantsContext.Provider>

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
