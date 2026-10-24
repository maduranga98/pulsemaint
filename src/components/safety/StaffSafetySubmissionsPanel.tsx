import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileCheck2, RefreshCw, Search } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { TrainingAssignment, TrainingModule } from '@/lib/training/trainingTypes';
import { SUBMISSION_QUEUES, getAssignmentQueue, type SubmissionQueue } from '@/lib/safety/submissionQueues';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import TrainingSignOffPanel from '@/components/training/manager/TrainingSignOffPanel';

const QUEUE_DEFAULTS: Record<SubmissionQueue, string> = {
  toSignoff: 'To sign off',
  reassignable: 'Reassignable',
  expired: 'Expired',
};

function fmt(ts: Timestamp | null | undefined): string {
  const d = (ts as { toDate?: () => Date } | null | undefined)?.toDate?.();
  return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

interface Props {
  assignments: TrainingAssignment[];
  modulesById: Map<string, TrainingModule>;
  /** Opens the assign dialog for a module, to reassign it (renew) for a person. */
  onReassign: (module: TrainingModule) => void;
}

/**
 * Company staff's in-app safety training submissions (quiz result, practical
 * sign-off, certificate), with the same three views as the contractor tab:
 * to sign off (then export the certificate), reassignable, and expired.
 */
export default function StaffSafetySubmissionsPanel({ assignments, modulesById, onReassign }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SubmissionQueue>('toSignoff');
  const [search, setSearch] = useState('');
  const [signingOff, setSigningOff] = useState<TrainingAssignment | null>(null);

  const classified = useMemo(() => {
    const now = Date.now();
    return assignments.map((a) => ({ a, queue: getAssignmentQueue(a, now) }));
  }, [assignments]);

  const counts = useMemo(() => {
    const c: Record<SubmissionQueue, number> = { toSignoff: 0, reassignable: 0, expired: 0 };
    for (const { queue } of classified) if (queue) c[queue] += 1;
    return c;
  }, [classified]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return classified
      .filter(({ queue }) => queue === filter)
      .filter(({ a }) => !term || [a.traineeName, a.department, a.moduleName].some((v) => (v ?? '').toLowerCase().includes(term)));
  }, [classified, filter, search]);

  const btn = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SUBMISSION_QUEUES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-amber-600 bg-amber-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t(`common.safetyTrainings.contractor.queues.${f}`, { defaultValue: QUEUE_DEFAULTS[f] })}
            <span className="ml-1 opacity-70">{counts[f]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.safetyTrainings.staff.searchPlaceholder', { defaultValue: 'Search name, department or training…' })}
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t('common.safetyTrainings.staff.empty', { defaultValue: 'No staff submissions in this view.' })}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ a, queue }) => {
            const module = modulesById.get(a.moduleId);
            return (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{a.traineeName}</span>
                      <TrainingStatusBadge status={a.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {a.department ? <span>{a.department}</span> : null}
                      <span>{a.moduleName}</span>
                      <span>
                        {t('common.safetyTrainings.staff.completedOn', { defaultValue: 'Completed' })}: {fmt(a.completedAt ?? a.quizPassedAt)}
                      </span>
                      <span>
                        {t('common.safetyTrainings.staff.validUntil', { defaultValue: 'Valid until' })}: {fmt(a.certificateExpiryDate)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase text-slate-400">{t('common.safetyTrainings.contractor.row.marks')}</div>
                    <div className="text-lg font-bold leading-tight text-slate-700">
                      {a.quizAttempts?.length ? `${a.latestScore}%` : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {queue === 'toSignoff' && (
                    <button type="button" onClick={() => setSigningOff(a)} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.signOff')}
                    </button>
                  )}
                  {(a.certificateId || a.status === 'certified') && (
                    <button type="button" onClick={() => navigate('/app/training/manage/certificates')} className={`${btn} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}>
                      <FileCheck2 className="h-3.5 w-3.5" /> {t('common.safetyTrainings.staff.exportCard', { defaultValue: 'Certificate / export card' })}
                    </button>
                  )}
                  {(queue === 'reassignable' || queue === 'expired') && module && (
                    <button type="button" onClick={() => onReassign(module)} className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                      <RefreshCw className="h-3.5 w-3.5" /> {t('common.safetyTrainings.contractor.actions.reassign')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {signingOff && <TrainingSignOffPanel assignment={signingOff} onClose={() => setSigningOff(null)} />}
    </div>
  );
}
