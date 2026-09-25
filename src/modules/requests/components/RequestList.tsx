import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StaffRequest, StaffRequestCategory, StaffRequestStatus } from '@/types/staffRequest';
import { STAFF_REQUEST_CATEGORIES } from '@/types/staffRequest';
import RequestCard from './RequestCard';
import { categoryLabel, field, statusLabel } from '../requestUi';

type StatusFilter = 'all' | StaffRequestStatus;
const STATUS_FILTERS: StatusFilter[] = ['all', 'open', 'answered', 'closed'];

export default function RequestList({
  requests,
  loading,
  error,
  mode,
  emptyText,
}: {
  requests: StaffRequest[];
  loading: boolean;
  error: string | null;
  mode: 'requester' | 'handler';
  emptyText: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<'all' | StaffRequestCategory>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: requests.length, open: 0, answered: 0, closed: 0 };
    requests.forEach((r) => { c[r.status] += 1; });
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (category !== 'all' && r.category !== category) return false;
      if (!term) return true;
      return [r.subject, r.message, r.requesterName, r.reference ?? '', r.department ?? '']
        .some((v) => v.toLowerCase().includes(term));
    });
  }, [requests, status, category, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s ? 'bg-[#1A56DB] text-white' : 'bg-[#142849] text-[#B8C7DB] hover:bg-[#1E3A5F]'
            }`}
          >
            {s === 'all' ? t('common.staffRequests.filters.all') : statusLabel(s, t)} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.staffRequests.filters.search')}
          className={`${field} sm:max-w-xs`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | StaffRequestCategory)}
          className={`${field} sm:max-w-xs`}
        >
          <option value="all">{t('common.staffRequests.filters.allCategories')}</option>
          {STAFF_REQUEST_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryLabel(c, t)}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-[#F87171]">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A56DB] border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#1E3A5F] px-4 py-10 text-center text-sm text-[#8BA3BF]">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <RequestCard key={r.id} request={r} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}
