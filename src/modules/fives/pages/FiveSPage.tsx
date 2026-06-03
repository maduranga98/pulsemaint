import { useState, useMemo } from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Lock, ShieldOff, ClipboardList, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { ZoneCard } from '../components/ZoneCard';
import { AuditForm } from '../components/AuditForm';
import { AuditDetail } from '../components/AuditDetail';
import { CorrectiveActionBoard } from '../components/CorrectiveActionBoard';
import { FiveSScorecard } from '../components/FiveSScorecard';
import { ZoneTrendChart } from '../components/ZoneTrendChart';
import { BestPracticeGallery } from '../components/BestPracticeGallery';
import {
  useAuditZones,
  useAuditHistory,
  useCorrectiveActions,
  useFactoryScore,
  useZoneTrend,
  useActiveAudit,
} from '../hooks/useFiveS';
import type { FiveSAudit, CorrectiveAction } from '../types/fives.types';

// ─── Access Denied ────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <ShieldOff className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white font-sora">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          The 5S Audit module is available to supervisors, managers, administrators, and assigned technicians.
        </p>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 rounded-full">
        403 — Insufficient Permissions
      </span>
    </div>
  );
}

// ─── Pro Gate ─────────────────────────────────────────────────────────────────

function ProFeatureGate({ feature }: { feature: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-blue-900/40 rounded-2xl p-10 flex flex-col items-center text-center gap-5">
      <div className="h-14 w-14 rounded-2xl bg-blue-900/30 border border-blue-700/50 flex items-center justify-center">
        <Lock className="h-6 w-6 text-blue-400" />
      </div>
      <div>
        <p className="text-base font-bold text-white font-sora">{feature}</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
          This feature is available on the Factory Pro plan. Upgrade to unlock zone trend charts,
          audit schedule automation, best-practice photo gallery, and factory-wide scorecard.
        </p>
      </div>
      <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30">
        Upgrade to Factory Pro
      </button>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

class SectionErrorBoundary extends Component<
  { children: ReactNode; section: string },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode; section: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`5S ${this.props.section} error:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-sm text-red-400">
          <p className="font-semibold mb-1">Error in {this.props.section}</p>
          <p className="text-red-500/80">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'zones' | 'audit' | 'history' | 'actions' | 'scorecard' | 'gallery';

const TABS: { id: TabId; label: string; proOnly?: boolean }[] = [
  { id: 'zones', label: 'Zones' },
  { id: 'audit', label: 'Start Audit' },
  { id: 'history', label: 'Audit History' },
  { id: 'actions', label: 'Corrective Actions' },
  { id: 'scorecard', label: 'Scorecard', proOnly: true },
  { id: 'gallery', label: 'Best Practices', proOnly: true },
];

// ─── Zones Tab ────────────────────────────────────────────────────────────────

function ZonesTab({
  onStartAudit,
  isProPlan,
}: {
  onStartAudit: (zoneId: string) => void;
  isProPlan: boolean;
}) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role;
  const isTech = role === 'technician';

  const { zones, loading } = useAuditZones();
  const { actions } = useCorrectiveActions({});
  const { audits } = useAuditHistory(null);

  const canStartAudit = ['technician', 'supervisor', 'plant_manager', 'admin'].includes(role ?? '');

  const visibleZones = isTech
    ? zones.filter(
        (z) => z.assignedAuditors.includes(userProfile?.id ?? '') || z.responsibleUserId === userProfile?.id,
      )
    : zones;

  const auditsByZone = useMemo(() => {
    const map: Record<string, FiveSAudit[]> = {};
    audits.forEach((a) => {
      if (!map[a.zoneId]) map[a.zoneId] = [];
      map[a.zoneId].push(a);
    });
    return map;
  }, [audits]);

  const caByZone = useMemo(() => {
    const map: Record<string, CorrectiveAction[]> = {};
    actions.forEach((ca) => {
      if (!map[ca.zoneId]) map[ca.zoneId] = [];
      map[ca.zoneId].push(ca);
    });
    return map;
  }, [actions]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 bg-slate-800/50 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (visibleZones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ClipboardList className="h-12 w-12 text-slate-600" />
        <div>
          <p className="text-slate-300 font-semibold">No zones configured</p>
          <p className="text-sm text-slate-500 mt-1">
            {isTech ? 'No zones are assigned to you yet.' : 'Create your first 5S zone to begin.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {visibleZones.map((zone) => {
        const zoneAudits = auditsByZone[zone.id] ?? [];
        const zoneCAs = caByZone[zone.id] ?? [];
        const openCAs = zoneCAs.filter((ca) => ca.status !== 'closed');
        const immediateCAs = openCAs.filter((ca) => ca.severity === 'immediate');

        return (
          <ZoneCard
            key={zone.id}
            zone={zone}
            recentAudits={zoneAudits.slice(0, 3)}
            openCACount={openCAs.length}
            immediateCACount={immediateCAs.length}
            canStartAudit={canStartAudit}
            isProPlan={isProPlan}
            onStartAudit={onStartAudit}
          />
        );
      })}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { zones } = useAuditZones();
  const [filterZone, setFilterZone] = useState('');
  const { audits, loading } = useAuditHistory(filterZone || null);
  const [selectedAudit, setSelectedAudit] = useState<FiveSAudit | null>(null);
  const { actions } = useCorrectiveActions({});

  function overallColor(score: number) {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-cyan-400';
    if (score >= 25) return 'text-amber-400';
    return 'text-red-400';
  }

  if (selectedAudit) {
    const auditCAs = actions.filter((ca) => ca.auditId === selectedAudit.id);
    return (
      <div>
        <button
          onClick={() => setSelectedAudit(null)}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          ← Back to history
        </button>
        <AuditDetail audit={selectedAudit} correctiveActions={auditCAs} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          value={filterZone}
          onChange={(e) => setFilterZone(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Zones</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <span className="text-xs text-slate-500">{audits.length} audits</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : audits.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No audits found</p>
        </div>
      ) : (
        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E3A5F] text-xs text-slate-400">
                <th className="text-left px-4 py-3">Zone</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Auditor</th>
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {audits.map((audit) => (
                <tr
                  key={audit.id}
                  onClick={() => setSelectedAudit(audit)}
                  className="hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-200 font-medium">{audit.zoneName}</td>
                  <td className="px-4 py-3 text-slate-400">{audit.auditDate}</td>
                  <td className="px-4 py-3 text-slate-400">{audit.auditorName}</td>
                  <td className={`px-4 py-3 text-right font-bold font-sora ${overallColor(audit.overallScore)}`}>
                    {audit.overallScore}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      audit.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                      audit.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{audit.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Scorecard Tab ────────────────────────────────────────────────────────────

function ScorecardTab() {
  const { zones } = useAuditZones();
  const { audits } = useAuditHistory(null);
  const { score: factoryScore } = useFactoryScore();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { trend } = useZoneTrend(selectedZone, 12);

  const snapshots = useMemo(() => {
    return zones.map((zone) => {
      const zoneAudits = audits
        .filter((a) => a.zoneId === zone.id)
        .sort((a, b) => b.auditDate.localeCompare(a.auditDate));
      return {
        zone,
        lastAudit: zoneAudits[0],
        prevAudit: zoneAudits[1],
      };
    });
  }, [zones, audits]);

  return (
    <div className="space-y-6">
      <FiveSScorecard snapshots={snapshots} factoryScore={factoryScore} />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-300">Zone Trend</p>
          <select
            value={selectedZone ?? ''}
            onChange={(e) => setSelectedZone(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select zone…</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        {selectedZone ? (
          <ZoneTrendChart
            trend={trend}
            zoneName={zones.find((z) => z.id === selectedZone)?.name}
          />
        ) : (
          <div className="h-32 bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl flex items-center justify-center text-slate-500 text-sm">
            Select a zone to view trend chart
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FiveSPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const role = userProfile?.role;

  const ALLOWED_ROLES = ['admin', 'plant_manager', 'supervisor', 'technician'];
  if (!role || !ALLOWED_ROLES.includes(role)) return <AccessDenied />;

  const plan = company?.plan;
  const isProPlan = plan === 'enterprise';

  const [activeTab, setActiveTab] = useState<TabId>('zones');
  const [auditZoneId, setAuditZoneId] = useState<string | undefined>();
  const { zones } = useAuditZones();
  const { actions } = useCorrectiveActions({});
  const { audits } = useAuditHistory(null);
  const activeDraft = useActiveAudit();

  const handleStartAudit = (zoneId: string) => {
    setAuditZoneId(zoneId);
    setActiveTab('audit');
  };

  const visibleTabs = TABS.filter((t) => {
    if (role === 'technician' && ['scorecard', 'gallery', 'history'].includes(t.id)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A1628]">
      {/* Header */}
      <div className="border-b border-[#1E3A5F] px-4 md:px-6 pt-6 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-white font-sora flex items-center gap-2">
                5S Audit System
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {zones.length} zones · {actions.filter((a) => a.status !== 'closed').length} open actions
              </p>
            </div>
            {activeDraft && (
              <button
                onClick={() => setActiveTab('audit')}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm font-semibold rounded-xl hover:bg-amber-500/30 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Resume Draft
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 pb-px scrollbar-hide">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.proOnly && !isProPlan) {
                    setActiveTab(tab.id);
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#1A56DB] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.proOnly && !isProPlan && (
                  <Lock className="h-3 w-3 text-slate-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {activeTab === 'zones' && (
          <SectionErrorBoundary section="Zones">
            <ZonesTab onStartAudit={handleStartAudit} isProPlan={isProPlan} />
          </SectionErrorBoundary>
        )}

        {activeTab === 'audit' && (
          <SectionErrorBoundary section="Audit Form">
            <AuditForm
              zones={zones}
              preselectedZoneId={auditZoneId ?? (role === 'technician' ? zones[0]?.id : undefined)}
              initialDraft={activeDraft}
              onComplete={(auditId) => {
                console.log('Audit submitted:', auditId);
                setActiveTab('history');
              }}
              onCancel={() => setActiveTab('zones')}
            />
          </SectionErrorBoundary>
        )}

        {activeTab === 'history' && (
          <SectionErrorBoundary section="Audit History">
            <HistoryTab />
          </SectionErrorBoundary>
        )}

        {activeTab === 'actions' && (
          <SectionErrorBoundary section="Corrective Actions">
            <CorrectiveActionBoard actions={actions} zones={zones} />
          </SectionErrorBoundary>
        )}

        {activeTab === 'scorecard' && (
          <SectionErrorBoundary section="Scorecard">
            {!isProPlan ? (
              <ProFeatureGate feature="Factory-Wide 5S Scorecard" />
            ) : (
              <ScorecardTab />
            )}
          </SectionErrorBoundary>
        )}

        {activeTab === 'gallery' && (
          <SectionErrorBoundary section="Best Practices">
            {!isProPlan ? (
              <ProFeatureGate feature="Best Practice Photo Gallery" />
            ) : (
              <BestPracticeGallery audits={audits} />
            )}
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}
