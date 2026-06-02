import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAuthStore } from '../../../store/authStore';
import { useTPMScore, useTPMTrend } from '../hooks/useTPM';
import { updatePillarScore } from '../services/tpm.service';
import type { TPMPillar } from '../types/tpm.types';
import { PILLAR_META } from '../types/tpm.types';
import type { TPMPillarId } from '../types/tpm.types';

// ─── Score History Chart ──────────────────────────────────────────────────────

function ScoreHistory({ pillarId }: { pillarId: TPMPillarId }) {
  const { data, loading } = useTPMTrend(6);

  const chartData = data.map((d) => ({
    month: d.month.slice(5), // MM
    score: d.pillars?.[pillarId] ?? 0,
  }));

  if (loading) {
    return <div className="h-40 bg-slate-700/40 rounded-xl animate-pulse" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-slate-500">
        No historical data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          cursor={{ fill: 'rgba(30, 41, 59, 0.5)' }}
        />
        <ReferenceLine y={85} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'WC', fill: '#10B981', fontSize: 10 }} />
        <Bar dataKey="score" fill="#1A56DB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── KPI Section ──────────────────────────────────────────────────────────────

function PillarKPIs({ pillarId }: { pillarId: TPMPillarId }) {
  // AM pillar shows AM compliance as a related KPI — others show generic
  const kpis: Record<TPMPillarId, { label: string; value: string }[]> = {
    AM: [{ label: 'AM Task Compliance (today)', value: 'See AM Tasks tab' }],
    PM: [{ label: 'PM On-Time Rate', value: 'From PM Schedules module' }],
    QM: [{ label: 'Defect Rate', value: 'From Quality module' }],
    FI: [{ label: 'Kaizen Events', value: 'Track via FI log' }],
    EEM: [{ label: 'New Equipment Audits', value: 'EEM Checklist' }],
    TE: [{ label: 'Training Completion', value: 'From Training module' }],
    SHE: [{ label: 'Safety Incidents (YTD)', value: 'SHE Report' }],
    OTPM: [{ label: 'Office Audit Score', value: 'OTPM Checklist' }],
  };

  const list = kpis[pillarId] ?? [];

  return (
    <div className="space-y-2">
      {list.map((kpi) => (
        <div key={kpi.label} className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
          <span className="text-xs text-slate-400">{kpi.label}</span>
          <span className="text-xs font-medium text-blue-400">{kpi.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Sheet ───────────────────────────────────────────────────────────────

interface TPMPillarDetailProps {
  pillarId: TPMPillarId | null;
  onClose: () => void;
}

export function TPMPillarDetail({ pillarId, onClose }: TPMPillarDetailProps) {
  const canEdit = useAuthStore((s) => s.canAccess(['supervisor', 'admin']));
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { pillars } = useTPMScore();

  const [score, setScore] = useState(0);
  const [actionPlan, setActionPlan] = useState('');
  const [responsible, setResponsible] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pillar: TPMPillar | undefined = pillars.find((p) => p.id === pillarId);
  const meta = pillarId ? PILLAR_META[pillarId] : null;

  useEffect(() => {
    if (pillar) {
      setScore(pillar.score);
      setActionPlan(pillar.actionPlan);
      setResponsible(pillar.responsible ?? '');
      setSaved(false);
      setSaveError(null);
    }
  }, [pillar]);

  const handleSave = async () => {
    if (!companyId || !pillarId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updatePillarScore(companyId, pillarId, score, actionPlan, responsible || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isOpen = pillarId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[480px] bg-slate-900 border-l border-slate-700/50 z-50 flex flex-col
          transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta?.icon ?? '🔧'}</span>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{pillarId}</p>
              <h3 className="text-base font-semibold text-white font-sora">{meta?.name}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Description */}
          {meta && (
            <p className="text-sm text-slate-400 leading-relaxed">{meta.description}</p>
          )}

          {/* Score Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Pillar Score
              </label>
              <span
                className={`text-lg font-bold font-sora ${
                  score >= 85 ? 'text-emerald-400' : score >= 65 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {score}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              disabled={!canEdit}
              className="w-full h-2 appearance-none bg-slate-700 rounded-full cursor-pointer accent-blue-500 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0 — Critical</span>
              <span>65 — Developing</span>
              <span>100 — World Class</span>
            </div>
          </div>

          {/* Score History Chart */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Score History (last 6 months)
            </p>
            {pillarId && <ScoreHistory pillarId={pillarId} />}
          </div>

          {/* Action Plan */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">
              Action Plan
            </label>
            <textarea
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              disabled={!canEdit}
              rows={4}
              placeholder="Describe improvement actions for this pillar…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
            />
          </div>

          {/* Responsible Person */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">
              Responsible Person (User ID)
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              disabled={!canEdit}
              placeholder="Enter user ID or name"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
            />
          </div>

          {/* Related KPIs */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Related KPIs
            </p>
            {pillarId && <PillarKPIs pillarId={pillarId} />}
          </div>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-700/50">
            {saveError && (
              <p className="text-xs text-red-400 mb-2">{saveError}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>✓ Saved</>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
