import { useState } from 'react';
import { Lock, ShieldOff } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { TPMDashboard } from '../components/TPMDashboard';
import { TPMMaturityRoadmap } from '../components/TPMMaturityRoadmap';
import { AMTaskBoard } from '../components/AMTaskBoard';
import { TPMPillarDetail } from '../components/TPMPillarDetail';
import { TPMScoreTrend } from '../components/TPMScoreTrend';
import type { TPMPillarId } from '../types/tpm.types';

// ─── Role Gate ────────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 text-center px-4">
      <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
        <ShieldOff className="h-7 w-7 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white font-sora">Access Restricted</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          The TPM module is available to supervisors, managers, and administrators only.
          Contact your administrator to request access.
        </p>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 rounded-full">
        403 — Insufficient Permissions
      </span>
    </div>
  );
}

// ─── Plan Gate ────────────────────────────────────────────────────────────────

function ProFeatureGate({ feature }: { feature: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-blue-900/40 rounded-2xl p-10 flex flex-col items-center text-center gap-5">
      <div className="h-14 w-14 rounded-2xl bg-blue-900/30 border border-blue-700/50 flex items-center justify-center">
        <Lock className="h-6 w-6 text-blue-400" />
      </div>
      <div>
        <p className="text-base font-bold text-white font-sora">{feature}</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
          This feature is available on the Factory Pro plan. Upgrade to unlock full TPM analytics,
          maturity roadmap, trend reports, and more.
        </p>
      </div>
      <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30">
        Upgrade to Factory Pro
      </button>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class SectionErrorBoundary extends Component<
  { children: ReactNode; section: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; section: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`TPM ${this.props.section} error:`, error, info);
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

// ─── Tab Types ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'pillars' | 'am-tasks' | 'maturity' | 'trend';

const TABS: { id: TabId; label: string; proOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pillars', label: '8 Pillars' },
  { id: 'am-tasks', label: 'AM Tasks' },
  { id: 'maturity', label: 'Maturity', proOnly: true },
  { id: 'trend', label: 'Trend', proOnly: true },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TPMPage() {
  const canView = useAuthStore((s) => s.canAccess(['supervisor', 'plant_manager', 'admin']));
  const plan = useAuthStore((s) => s.company?.plan);
  const isProPlan = plan === 'enterprise';

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedPillarId, setSelectedPillarId] = useState<TPMPillarId | null>(null);

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 lg:p-6">
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white font-sora">
              Total Productive Maintenance
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              8-pillar TPM framework — scores, AM tasks, and maturity roadmap
            </p>
          </div>
          {!isProPlan && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800/40 rounded-xl text-xs text-blue-400">
              <Lock className="h-3.5 w-3.5" />
              <span>Factory plan · <span className="font-semibold">Upgrade for full TPM</span></span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
          {TABS.map((tab) => {
            const isLocked = tab.proOnly && !isProPlan;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${isActive ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                {tab.label}
                {isLocked && <Lock className="h-3 w-3 text-blue-400/70" />}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <SectionErrorBoundary section="Overview">
              <TPMDashboard
                onPillarSelect={(id) => {
                  setSelectedPillarId(id as TPMPillarId);
                  setActiveTab('pillars');
                }}
                showMaturity={false}
              />
            </SectionErrorBoundary>
          )}

          {activeTab === 'pillars' && (
            <SectionErrorBoundary section="8 Pillars">
              <TPMDashboard
                onPillarSelect={(id) => setSelectedPillarId(id as TPMPillarId)}
                showMaturity={false}
              />
            </SectionErrorBoundary>
          )}

          {activeTab === 'am-tasks' && (
            <SectionErrorBoundary section="AM Tasks">
              <AMTaskBoard />
            </SectionErrorBoundary>
          )}

          {activeTab === 'maturity' && (
            <SectionErrorBoundary section="Maturity">
              {isProPlan ? (
                <TPMMaturityRoadmap />
              ) : (
                <ProFeatureGate feature="TPM Maturity Roadmap" />
              )}
            </SectionErrorBoundary>
          )}

          {activeTab === 'trend' && (
            <SectionErrorBoundary section="Trend">
              {isProPlan ? (
                <TPMScoreTrend />
              ) : (
                <ProFeatureGate feature="TPM Score Trend Analytics" />
              )}
            </SectionErrorBoundary>
          )}
        </div>
      </div>

      {/* Pillar Detail Slide-in Panel */}
      <TPMPillarDetail
        pillarId={selectedPillarId}
        onClose={() => setSelectedPillarId(null)}
      />
    </div>
  );
}
