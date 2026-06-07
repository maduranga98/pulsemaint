import { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Wrench,
  Sparkles,
  Gauge,
  HardHat,
  ShieldOff,
  ChevronRight,
  Plus,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import type { UserRole } from '../../../types/auth';
import {
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditTemplate,
  type AuditSession,
} from '../types/audit.types';
import { useAuditTemplates, useAuditSessions } from '../hooks/useAudit';
import { AuditSessionForm } from '../components/AuditSessionForm';
import { AuditTaskConfigurator } from '../components/AuditTaskConfigurator';
import { AuditDetail } from '../components/AuditDetail';

const ALLOWED_ROLES: UserRole[] = ['supervisor', 'plant_manager', 'admin', 'technician'];

const CATEGORY_META: Record<AuditCategory, { icon: typeof Wrench; color: string; desc: string }> = {
  tpm: { icon: Wrench, color: 'text-blue-400', desc: 'Total Productive Maintenance checks' },
  fives: { icon: Sparkles, color: 'text-emerald-400', desc: 'Workplace 5S organisation audit' },
  oee: { icon: Gauge, color: 'text-amber-400', desc: 'Availability, performance & quality losses' },
  contractor: { icon: HardHat, color: 'text-purple-400', desc: 'Contractor safety & work-quality audit' },
};

const ORDER: AuditCategory[] = ['tpm', 'fives', 'oee', 'contractor'];

type View =
  | { kind: 'home' }
  | { kind: 'audit'; template: AuditTemplate }
  | { kind: 'configure'; template: AuditTemplate }
  | { kind: 'detail'; session: AuditSession };

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <ShieldOff className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white font-sora">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          The Audit module is available to supervisors, managers, administrators, and technicians.
        </p>
      </div>
    </div>
  );
}

export function AuditPage() {
  const role = useAuthStore((s) => s.userProfile?.role);
  const plantId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { templates, loading } = useAuditTemplates();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [historyCategory, setHistoryCategory] = useState<AuditCategory | ''>('');

  const { sessions, loading: sessionsLoading } = useAuditSessions(
    historyCategory ? { category: historyCategory } : {},
  );

  const templatesByCategory = useMemo(() => {
    const map: Partial<Record<AuditCategory, AuditTemplate>> = {};
    for (const t of templates) if (!map[t.category]) map[t.category] = t;
    return map;
  }, [templates]);

  if (role && !ALLOWED_ROLES.includes(role)) return <AccessDenied />;

  // ── Sub-views ───────────────────────────────────────────────────────────────
  if (view.kind === 'audit') {
    return (
      <div className="p-4 md:p-6">
        <AuditSessionForm
          template={view.template}
          onConfigure={() => setView({ kind: 'configure', template: view.template })}
          onDone={() => setView({ kind: 'home' })}
        />
      </div>
    );
  }

  if (view.kind === 'configure') {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="text-lg font-bold text-white font-sora mb-1">
          Configure {AUDIT_CATEGORY_LABELS[view.template.category]}
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

  if (view.kind === 'detail') {
    return (
      <div className="p-4 md:p-6">
        <AuditDetail session={view.session} onBack={() => setView({ kind: 'home' })} />
      </div>
    );
  }

  // ── Home ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-sora">Audits</h1>
          <p className="text-sm text-slate-400">TPM · 5S · OEE · Contractor audits with AI root-cause analysis</p>
        </div>
      </div>

      {/* Category cards */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit templates…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const tmpl = templatesByCategory[cat];
            return (
              <div
                key={cat}
                className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-600 transition-colors"
              >
                <Icon className={`h-7 w-7 ${meta.color}`} />
                <div>
                  <h3 className="text-base font-bold text-white font-sora">{AUDIT_CATEGORY_LABELS[cat]}</h3>
                  <p className="text-xs text-slate-400 mt-1">{meta.desc}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {tmpl ? `${tmpl.tasks.length} tasks` : '—'}
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

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white font-sora">Recent Audits</h2>
          <select
            value={historyCategory}
            onChange={(e) => setHistoryCategory(e.target.value as AuditCategory | '')}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {ORDER.map((c) => (
              <option key={c} value={c}>{AUDIT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-700 rounded-xl">
            No audits submitted yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setView({ kind: 'detail', session: s })}
                className="w-full flex items-center justify-between gap-3 p-3 bg-slate-800/40 border border-slate-700 rounded-xl hover:border-slate-600 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {AUDIT_CATEGORY_LABELS[s.category]}
                    <span className="text-slate-500 font-normal"> · {s.auditDate}</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.auditorName} · {s.department || 'No dept'} · {s.machines.length} machine(s)
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.reportUrl && <FileCheck className="h-4 w-4 text-blue-400" />}
                  <span className={`text-sm font-bold ${s.score >= 80 ? 'text-emerald-400' : s.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {s.score}%
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditPage;
