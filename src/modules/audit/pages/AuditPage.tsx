import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Wrench,
  Sparkles,
  Gauge,
  HardHat,
  ShieldOff,
  Plus,
  Loader2,
  ClipboardList,
  History,
  PlayCircle,
  User,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import type { UserRole } from '../../../types/auth';
import {
  getCategoryLabel,
  type AuditCategory,
  type AuditTemplate,
  type AuditSession,
  type AuditDraft,
} from '../types/audit.types';
import { useAuditTemplates, useAuditSessions, useInProgressDrafts } from '../hooks/useAudit';
import { AuditSessionForm } from '../components/AuditSessionForm';
import { AuditTaskConfigurator } from '../components/AuditTaskConfigurator';
import { AuditDetail } from '../components/AuditDetail';

// Keep in sync with the /app/audit route guard in AppRouter — the Audit
// module is not available to technician, trainee, floor_operator, or
// store_keeper roles.
const ALLOWED_ROLES: UserRole[] = ['supervisor', 'plant_manager', 'admin', 'hr_officer', 'safety_officer'];

const CATEGORY_META: Record<string, { icon: typeof Wrench; color: string; desc: string }> = {
  tpm: { icon: Wrench, color: 'text-blue-400', desc: 'Total Productive Maintenance checks' },
  fives: { icon: Sparkles, color: 'text-emerald-400', desc: 'Workplace 5S organisation audit' },
  moe: { icon: Gauge, color: 'text-amber-400', desc: 'Availability, performance & quality losses' },
  contractor: { icon: HardHat, color: 'text-purple-400', desc: 'Contractor safety & work-quality audit' },
};
const DEFAULT_CATEGORY_META = { icon: ClipboardList, color: 'text-slate-400', desc: 'Custom audit checklist' };

type View =
  | { kind: 'home' }
  | { kind: 'audit'; template: AuditTemplate; draft?: AuditDraft }
  | { kind: 'configure'; template: AuditTemplate }
  | { kind: 'create' }
  | { kind: 'detail'; session: AuditSession };

type Tab = 'inProgress' | 'library' | 'completed';

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <ShieldOff className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white font-sora">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          The Audit module is available to supervisors, plant managers, administrators, HR officers, and safety officers.
        </p>
      </div>
    </div>
  );
}

export function AuditPage() {
  const role = useAuthStore((s) => s.userProfile?.role);
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const plantId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { templates, loading } = useAuditTemplates();
  const { sessions, loading: sessionsLoading } = useAuditSessions();
  const { drafts, loading: draftsLoading } = useInProgressDrafts();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [tab, setTab] = useState<Tab>('library');

  const isAdmin = role === 'admin';
  // Completed audits are only ever visible to admins — every other role
  // stops seeing an audit session once it's submitted.
  const completedSessions = useMemo(
    () =>
      isAdmin
        ? sessions.filter((s) => s.status === 'submitted').sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0))
        : [],
    [sessions, isAdmin]
  );

  // Data-driven category list: one card per distinct category present in
  // Firestore (built-ins ship pre-seeded by ensureDefaultTemplates; admins
  // can add more via "New Audit Category" without a code change).
  const categoryOrder = useMemo(() => {
    const seen = new Set<AuditCategory>();
    const order: AuditCategory[] = [];
    for (const t of templates) {
      if (!seen.has(t.category)) {
        seen.add(t.category);
        order.push(t.category);
      }
    }
    return order;
  }, [templates]);

  const templatesByCategory = useMemo(() => {
    const map: Partial<Record<AuditCategory, AuditTemplate>> = {};
    for (const t of templates) if (!map[t.category]) map[t.category] = t;
    return map;
  }, [templates]);

  const inProgressDrafts = useMemo(
    () => [...drafts].sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || '')),
    [drafts],
  );

  if (role && !ALLOWED_ROLES.includes(role)) return <AccessDenied />;

  // ── Sub-views ───────────────────────────────────────────────────────────────
  if (view.kind === 'audit') {
    return (
      <div className="p-4 md:p-6">
        <AuditSessionForm
          template={view.template}
          initialDraft={view.draft}
          onConfigure={() => setView({ kind: 'configure', template: view.template })}
          onDone={() => setView({ kind: 'home' })}
        />
      </div>
    );
  }

  if (view.kind === 'detail') {
    return (
      <div className="p-4 md:p-6">
        <AuditDetail session={view.session} onBack={() => setView({ kind: 'home' })} />
      </div>
    );
  }

  if (view.kind === 'configure') {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-white font-sora mb-1">
          Configure {getCategoryLabel(view.template.category, view.template.name)}
        </h2>
        <p className="text-sm text-slate-400 mb-5">
          Add or remove tasks and choose the answer type (Yes/No, Scale, Text) for each.
        </p>
        <AuditTaskConfigurator
          plantId={plantId}
          template={view.template}
          onSaved={() => setView({ kind: 'home' })}
          onClose={() => setView({ kind: 'audit', template: view.template })}
        />
      </div>
    );
  }

  if (view.kind === 'create') {
    if (!isAdmin) return <AccessDenied />;
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-white font-sora mb-1">New Audit Category</h2>
        <p className="text-sm text-slate-400 mb-5">
          Create a custom audit category with its own checklist. It will appear on the Audit home
          page for everyone with audit access; only admins can edit its tasks afterward.
        </p>
        <AuditTaskConfigurator
          plantId={plantId}
          createNew
          onSaved={(created) => setView({ kind: 'audit', template: created })}
          onClose={() => setView({ kind: 'home' })}
        />
      </div>
    );
  }

  // ── Home ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-sora">Audits</h1>
          <p className="text-sm text-slate-400">TPM · 5S · MOE · Contractor audits with AI root-cause analysis</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-700">
        {(
          [
            { value: 'inProgress', label: 'In Progress', count: inProgressDrafts.length },
            { value: 'library', label: 'Audit Library', count: 0 },
            // Completed audits are only ever visible to admins.
            ...(isAdmin ? [{ value: 'completed' as Tab, label: 'Completed', count: 0 }] : []),
          ] as { value: Tab; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.value === 'inProgress' && t.count > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'inProgress' && (
        draftsLoading || loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : inProgressDrafts.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-500 gap-2">
            <PlayCircle className="h-8 w-8" />
            <p className="text-sm">No audits in progress.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {inProgressDrafts.map((draft) => {
              const meta = CATEGORY_META[draft.category] ?? DEFAULT_CATEGORY_META;
              const Icon = meta.icon;
              const tmpl = templatesByCategory[draft.category];
              const isOwner = draft.userId === userId;
              return (
                <div
                  key={draft.id}
                  className="bg-slate-800/40 border border-amber-700/40 rounded-2xl p-5 flex flex-col gap-3"
                >
                  <Icon className={`h-7 w-7 ${meta.color}`} />
                  <div>
                    <h3 className="text-base font-bold text-white font-sora">
                      {getCategoryLabel(draft.category, draft.templateName)}
                    </h3>
                    {!isOwner && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                        <User className="h-3 w-3" /> {draft.userName}
                      </p>
                    )}
                    <p className="text-[11px] text-amber-400 mt-1">
                      Last saved {new Date(draft.lastSaved).toLocaleString()}
                    </p>
                  </div>
                  {isOwner ? (
                    <button
                      disabled={!tmpl}
                      onClick={() => tmpl && setView({ kind: 'audit', template: tmpl, draft })}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50"
                    >
                      <PlayCircle className="h-4 w-4" /> Resume Audit
                    </button>
                  ) : (
                    <span className="mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-400 border border-amber-700/40 rounded-lg">
                      In progress by {draft.userName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'library' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setView({ kind: 'create' })}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg shrink-0"
              >
                <Plus className="h-4 w-4" /> New Audit Category
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading audit templates…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categoryOrder.map((cat) => {
                const meta = CATEGORY_META[cat] ?? DEFAULT_CATEGORY_META;
                const Icon = meta.icon;
                const tmpl = templatesByCategory[cat];
                return (
                  <div
                    key={cat}
                    className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-600 transition-colors"
                  >
                    <Icon className={`h-7 w-7 ${meta.color}`} />
                    <div>
                      <h3 className="text-base font-bold text-white font-sora">
                        {getCategoryLabel(cat, tmpl?.name)}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{meta.desc}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {tmpl ? `${tmpl.tasks.length} tasks` : ''}
                      </p>
                    </div>
                    <button
                      disabled={!tmpl}
                      onClick={() => tmpl && setView({ kind: 'audit', template: tmpl })}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" /> Start Audit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'completed' && (
        sessionsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : completedSessions.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-500 gap-2">
            <History className="h-8 w-8" />
            <p className="text-sm">No completed audits yet.</p>
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl divide-y divide-slate-700 overflow-hidden">
            {completedSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setView({ kind: 'detail', session })}
                className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-800/70 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {getCategoryLabel(session.category, session.templateName)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {session.auditDate} · {session.auditorName}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-400">
                  {session.score}% · {session.passedTasks}/{session.totalTasks}
                </span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default AuditPage;
