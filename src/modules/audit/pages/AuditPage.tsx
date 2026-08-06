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
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import type { UserRole } from '../../../types/auth';
import {
  getCategoryLabel,
  type AuditCategory,
  type AuditTemplate,
} from '../types/audit.types';
import { useAuditTemplates } from '../hooks/useAudit';
import { AuditSessionForm } from '../components/AuditSessionForm';
import { AuditTaskConfigurator } from '../components/AuditTaskConfigurator';

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
  | { kind: 'audit'; template: AuditTemplate }
  | { kind: 'configure'; template: AuditTemplate }
  | { kind: 'create' };

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
  const plantId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { templates, loading } = useAuditTemplates();
  const [view, setView] = useState<View>({ kind: 'home' });

  const isAdmin = role === 'admin';

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
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-sora">Audits</h1>
            <p className="text-sm text-slate-400">TPM · 5S · MOE · Contractor audits with AI root-cause analysis</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setView({ kind: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg shrink-0"
          >
            <Plus className="h-4 w-4" /> New Audit Category
          </button>
        )}
      </div>

      {/* Category cards */}
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
  );
}

export default AuditPage;
