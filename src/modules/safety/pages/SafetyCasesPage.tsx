import { useMemo, useState } from 'react';
import { ShieldAlert, Plus, ChevronDown, ChevronRight, Send } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useSafetyCases } from '@/hooks/safety/useSafety';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { addSafetyCaseAction, reportSafetyCaseTo } from '@/services/safety.service';
import { createNotification } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import {
  SAFETY_CASE_SUBJECT_TYPES,
  SAFETY_CASE_TYPES,
  type SafetyCase,
  type SafetyCaseStatus,
} from '@/types/safety';

const TYPE_LABEL = Object.fromEntries(SAFETY_CASE_TYPES.map((t) => [t.value, t.label]));
const SUBJECT_LABEL = Object.fromEntries(SAFETY_CASE_SUBJECT_TYPES.map((s) => [s.value, s.label]));

const SEV_COLOR: Record<string, string> = {
  low: 'text-[#10B981]',
  medium: 'text-[#EAB308]',
  high: 'text-[#F59E0B]',
  critical: 'text-[#EF4444]',
};
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#F59E0B]/15 text-[#F59E0B]',
  investigating: 'bg-[#1A56DB]/15 text-[#5B8DEF]',
  closed: 'bg-[#10B981]/15 text-[#10B981]',
};
const field = 'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';

/**
 * Roles that only see cases escalated to them (via "report to") — both the
 * managers a safety officer escalates up to, and the frontline roles a case
 * gets assigned down to for action. Also the set of valid "report to"
 * recipients, so a case can actually be assigned to any of them.
 */
const REPORTED_TO_ROLES = [
  'admin', 'plant_manager', 'supervisor', 'hr_officer',
  'technician', 'floor_operator', 'store_keeper', 'trainee',
];

function fmt(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '';
  try {
    return ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export default function SafetyCasesPage() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const role = profile?.role ?? '';
  const isSafetyOfficer = role === 'safety_officer';
  const { cases, loading } = useSafetyCases(companyId);

  // Safety officers own the whole board; managers see only cases reported to
  // them. Closed cases drop out of every non-admin role's view entirely —
  // admin is the only role that keeps seeing them.
  const visible = useMemo(() => {
    let list = cases;
    if (!isSafetyOfficer && REPORTED_TO_ROLES.includes(role)) {
      list = list.filter((c) => c.reportedToUserId === profile?.id);
    }
    if (role !== 'admin') list = list.filter((c) => c.status !== 'closed');
    return list;
  }, [cases, isSafetyOfficer, role, profile?.id]);

  const heading = isSafetyOfficer ? 'Safety Cases' : 'Safety Cases Reported to Me';
  const subtitle = isSafetyOfficer
    ? 'Log actions and track every reported safety case.'
    : 'Cases the safety team has escalated to you.';

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 font-[Sora] text-xl font-bold text-[#F0F4F8]">
          <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> {heading}
        </h1>
        <p className="mt-0.5 text-sm text-[#8BA3BF]">{subtitle}</p>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-8">
        <DashboardWidget title={`Cases (${visible.length})`}>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg border border-[#1E3A5F] bg-[#0F1E35]" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState message={isSafetyOfficer ? 'No safety cases logged yet' : 'No cases have been reported to you'} />
          ) : (
            <div className="space-y-2">
              {visible.map((c) => (
                <CaseRow key={c.id} c={c} canAct={c.status !== 'closed' && (isSafetyOfficer || REPORTED_TO_ROLES.includes(role))} />
              ))}
            </div>
          )}
        </DashboardWidget>
      </div>
    </div>
  );
}

function CaseRow({ c, canAct }: { c: SafetyCase; canAct: boolean }) {
  const profile = useAuthStore((s) => s.userProfile);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState<SafetyCaseStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [reportTo, setReportTo] = useState('');
  const [reporting, setReporting] = useState(false);

  const actions = c.actions ?? [];

  // People a case can be escalated to — oversight roles in the company.
  const { users } = useCompanyUsers(profile?.companyId);
  const reportRecipients = useMemo(
    () => users.filter((u) => REPORTED_TO_ROLES.includes(u.role) && u.id !== profile?.id),
    [users, profile?.id],
  );

  async function submitReportTo() {
    const target = reportRecipients.find((u) => u.id === reportTo);
    if (!target) {
      toast.error('Choose who to report this case to.');
      return;
    }
    setReporting(true);
    try {
      await reportSafetyCaseTo(c.id, {
        toUserId: target.id,
        toUserName: target.fullName,
        toUserRole: target.role,
        by: profile?.id ?? '',
        byName: profile?.fullName ?? '',
        byRole: profile?.role ?? '',
      });
      await createNotification({
        companyId: profile?.companyId ?? '',
        type: 'alert',
        severity: c.severity === 'critical' ? 'critical' : 'high',
        message: `Safety case reported to you: ${c.title}`,
        linkTo: '/app/safety/cases',
        recipientUserIds: [target.id],
        actorName: profile?.fullName ?? '',
        actorRole: (profile?.role ?? null) as UserRole | null,
        actorUserId: profile?.id ?? null,
      }).catch(() => {/* notification is best-effort */});
      toast.success(`Reported to ${target.fullName}.`);
      setReportTo('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to report the case.');
    } finally {
      setReporting(false);
    }
  }

  async function submitAction() {
    if (!note.trim() && !newStatus) {
      toast.error('Add a note or change the status.');
      return;
    }
    setSaving(true);
    try {
      await addSafetyCaseAction(c.id, {
        note: note.trim(),
        newStatus: newStatus || null,
        by: profile?.id ?? '',
        byName: profile?.fullName ?? '',
        byRole: profile?.role ?? '',
      });
      toast.success('Action recorded.');
      setNote('');
      setNewStatus('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to record action.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-[#8BA3BF]" /> : <ChevronRight className="h-4 w-4 text-[#8BA3BF]" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-[#F0F4F8]">{c.title}</div>
          <div className="truncate text-xs text-[#8BA3BF]">
            {TYPE_LABEL[c.type] ?? c.type}
            {c.subjectType && c.subjectType !== 'other' && ` · ${SUBJECT_LABEL[c.subjectType] ?? c.subjectType}`}
            {c.subjectName && `: ${c.subjectName}`}
          </div>
        </div>
        <span className={`shrink-0 text-xs font-semibold ${SEV_COLOR[c.severity] ?? ''}`}>{c.severity}</span>
        {typeof c.points === 'number' && <span className="shrink-0 text-xs text-[#F59E0B]">{c.points} pts</span>}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#1E3A5F] px-3 py-3">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Detail label="Reported by" value={`${c.reportedByName} (${c.reportedByRole})`} />
            <Detail label="Reported at" value={fmt(c.reportedAt) || '—'} />
            {c.location && <Detail label="Location" value={c.location} />}
            {c.reportedToName && <Detail label="Reported to" value={c.reportedToName} />}
          </div>
          {c.description && <Detail label="What happened" value={c.description} block />}
          {c.actionToTake && <Detail label="Action that should be taken" value={c.actionToTake} block />}

          {/* Action log */}
          <div>
            <div className="mb-1 text-xs font-medium text-[#8BA3BF]">Actions taken ({actions.length})</div>
            {actions.length === 0 ? (
              <p className="text-xs text-[#8BA3BF]">No actions recorded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {actions.map((a, i) => (
                  <li key={i} className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
                    {a.note && <div className="text-sm text-[#F0F4F8]">{a.note}</div>}
                    <div className="text-xs text-[#8BA3BF]">
                      {a.byName} ({a.byRole}){a.newStatus ? ` · → ${a.newStatus}` : ''}{fmt(a.at) ? ` · ${fmt(a.at)}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {c.status === 'closed' && (
            <p className="text-xs text-[#8BA3BF]">This case is closed and can no longer be edited.</p>
          )}

          {canAct && (
            <div className="space-y-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              <div className="text-xs font-medium text-[#8BA3BF]">Record an action</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="What was done about this case?"
                className={field}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as SafetyCaseStatus | '')} className={`${field} sm:w-auto`}>
                  <option value="">Keep status ({c.status})</option>
                  <option value="open">Set to Open</option>
                  <option value="investigating">Set to Investigating</option>
                  <option value="closed">Set to Closed</option>
                </select>
                <button
                  type="button"
                  onClick={() => void submitAction()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> {saving ? 'Saving…' : 'Record'}
                </button>
              </div>

              {/* Report to — escalate this case to a manager/supervisor, who
                  then sees it on their Safety Cases board and gets notified. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-[#1E3A5F] pt-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#8BA3BF]">
                  <Send className="h-3.5 w-3.5" /> Report to
                </span>
                <select value={reportTo} onChange={(e) => setReportTo(e.target.value)} className={`${field} sm:w-auto`}>
                  <option value="">Select a person…</option>
                  {reportRecipients.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void submitReportTo()}
                  disabled={reporting || !reportTo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1A56DB] px-4 py-2 text-sm font-bold text-[#5B8DEF] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> {reporting ? 'Reporting…' : 'Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, block }: { label: string; value: string; block?: boolean }) {
  return (
    <div className={block ? 'sm:col-span-2' : ''}>
      <div className="text-xs text-[#8BA3BF]">{label}</div>
      <div className="text-sm text-[#F0F4F8]">{value}</div>
    </div>
  );
}
