import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useSafetyCases } from '../../../hooks/safety/useSafety';
import { useTranslation } from 'react-i18next';

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-500/15 text-amber-300',
  investigating: 'bg-blue-500/15 text-blue-300',
  closed: 'bg-emerald-500/15 text-emerald-300',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

// Safety cases relevant to me: escalated to me for action
// (reportedToUserId === me), or reported naming me as the subject
// (subjectType 'technician'/'operator', subjectId === me) — the report form
// lets the reporter pick who the case is about, and that person needs to
// see it too even if it wasn't escalated to them specifically.
export default function MySafetyCasesWidget() {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { cases, loading } = useSafetyCases(companyId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mine = cases.filter(
    (c) =>
      c.status !== 'closed' &&
      (c.reportedToUserId === userProfile?.id || c.subjectId === userProfile?.id),
  );

  return (
    <DashboardWidget title={t('common.widgets.mySafetyCasesWidget.title')} loading={loading}>
      {mine.length === 0 ? (
        <EmptyState message={t('common.widgets.mySafetyCasesWidget.empty')} />
      ) : (
        <div className="space-y-2">
          {mine.map((c) => {
            const isOpen = expandedId === c.id;
            return (
              <div key={c.id} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === c.id ? null : c.id))}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[#0F1E35] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#F0F4F8] truncate">{c.title || c.type}</p>
                    <p className="text-[11px] text-[#8BA3BF]">{c.type.replace('_', ' ')}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[c.severity] ?? 'bg-slate-500 text-white'}`}>
                      {c.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLOR[c.status] ?? 'bg-[#1E3A5F] text-[#8BA3BF]'}`}>
                      {c.status}
                    </span>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#8BA3BF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8BA3BF]" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-[#1E3A5F] pt-2.5">
                    {c.description && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8BA3BF]">{t('common.widgets.mySafetyCasesWidget.description')}</p>
                        <p className="text-sm text-[#F0F4F8] whitespace-pre-wrap">{c.description}</p>
                      </div>
                    )}
                    {c.location && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8BA3BF]">{t('common.widgets.mySafetyCasesWidget.location')}</p>
                        <p className="text-sm text-[#F0F4F8]">{c.location}</p>
                      </div>
                    )}
                    {c.actionToTake && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">{t('common.widgets.mySafetyCasesWidget.whatYouNeedToDo')}</p>
                        <p className="text-sm text-[#F0F4F8] whitespace-pre-wrap">{c.actionToTake}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8BA3BF]">
                        {c.actions.length > 0 ? t('common.widgets.mySafetyCasesWidget.actionsTakenCount', { count: c.actions.length }) : t('common.widgets.mySafetyCasesWidget.actionsTaken')}
                      </p>
                      {c.actions.length === 0 ? (
                        <p className="text-sm text-[#8BA3BF] italic">{t('common.widgets.mySafetyCasesWidget.noActionsYet')}</p>
                      ) : (
                        <ul className="space-y-1.5 mt-1">
                          {c.actions.map((a, i) => (
                            <li key={i} className="text-sm text-[#F0F4F8]">
                              <span className="text-[#60A5FA]">{a.byName}</span>
                              {a.byRole && <span className="text-[#8BA3BF]"> ({a.byRole})</span>}
                              {a.newStatus && <span className="text-[#8BA3BF]"> — {t('common.widgets.mySafetyCasesWidget.movedTo', { status: a.newStatus })}</span>}
                              <p className="text-[#8BA3BF] whitespace-pre-wrap">{a.note}</p>
                              <p className="text-[11px] text-[#5B7A99]">{a.at?.toDate?.().toLocaleString?.() ?? ''}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
