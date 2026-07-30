import { useMemo, useState } from 'react';
import { Plus, FileCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useWorkPermits } from '@/hooks/safety/useSafety';
import { updateWorkPermitStatus } from '@/services/safety.service';
import { WORK_PERMIT_CATEGORIES, type WorkPermitCategory, type WorkPermitStatus } from '@/types/safety';
import NewWorkPermitModal from '../components/NewWorkPermitModal';

const CAT_LABEL = Object.fromEntries(WORK_PERMIT_CATEGORIES.map((c) => [c.value, c.label])) as Record<WorkPermitCategory, string>;

const STATUS_STYLE: Record<WorkPermitStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300',
  active: 'bg-[#10B981]/15 text-[#10B981]',
  closed: 'bg-slate-500/15 text-slate-400',
  expired: 'bg-[#EF4444]/15 text-[#EF4444]',
};

type Filter = 'all' | WorkPermitCategory;

export default function WorkPermitsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const toast = useToast();
  const { permits, loading } = useWorkPermits(companyId);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? permits : permits.filter((p) => p.category === filter)),
    [permits, filter],
  );

  async function setStatus(id: string, status: WorkPermitStatus) {
    try {
      await updateWorkPermitStatus(id, status);
    } catch {
      toast.error('Failed to update permit.');
    }
  }

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 font-[Sora] text-xl font-bold">
            <FileCheck className="h-5 w-5 text-[#5B8DEF]" /> Work Permits
          </h1>
          <p className="mt-0.5 text-sm text-[#8BA3BF]">Permit-to-Work: issue, track, and close safety permits by category.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> New Permit
        </button>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-8">
        {/* Category filter */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', ...WORK_PERMIT_CATEGORIES.map((c) => c.value)] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f ? 'bg-[#1A56DB] text-white' : 'bg-[#0F1E35] text-[#8BA3BF] hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : CAT_LABEL[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[#1E3A5F] bg-[#0F1E35]" />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-6">
            <EmptyState message="No permits in this category" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#1A56DB]/15 px-2 py-0.5 text-xs font-semibold text-[#5B8DEF]">{CAT_LABEL[p.category]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                    </div>
                    <h3 className="mt-1.5 font-semibold text-[#F0F4F8]">{p.title}</h3>
                    <p className="text-xs text-[#8BA3BF]">{p.location || 'No location'} · {p.permitNumber}</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[#8BA3BF]">Valid {p.validFrom} → {p.validTo}</div>
                {p.precautions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.precautions.map((pr) => (
                      <span key={pr} className="rounded bg-[#0A1628] px-2 py-0.5 text-[10px] text-[#8BA3BF]">{pr}</span>
                    ))}
                  </div>
                )}
                {p.status === 'active' && (
                  <div className="mt-3 flex gap-2 border-t border-[#1E3A5F] pt-3">
                    <button type="button" onClick={() => void setStatus(p.id, 'closed')} className="text-xs font-semibold text-[#10B981] hover:underline">Close permit</button>
                    <button type="button" onClick={() => void setStatus(p.id, 'expired')} className="text-xs font-semibold text-[#EF4444] hover:underline">Mark expired</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <NewWorkPermitModal onClose={() => setCreating(false)} />}
    </div>
  );
}
