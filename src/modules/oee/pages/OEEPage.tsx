import { useState } from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Lock, ShieldOff, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { OEEDashboard } from '../components/OEEDashboard';
import { OEEInputForm } from '../components/OEEInputForm';
import { OEEMachineDetail } from '../components/OEEMachineDetail';
import type { MachineSummary } from '../types/oee.types';

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
          The OEE module is available to supervisors, managers, and administrators only.
        </p>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 rounded-full">
        403 — Insufficient Permissions
      </span>
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
    console.error(`OEE ${this.props.section} error:`, error, info);
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

type TabId = 'dashboard' | 'input';

const TABS: { id: TabId; label: string; inputOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'input', label: 'Input OEE Data', inputOnly: true },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OEEPage() {
  const navigate = useNavigate();
  const canView = useAuthStore((s) => s.canAccess(['supervisor', 'plant_manager', 'admin']));
  const canInput = useAuthStore((s) => s.canAccess(['supervisor', 'admin']));
  const isProPlan = true;

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedMachine, setSelectedMachine] = useState<MachineSummary | null>(null);

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 lg:p-6">
        <AccessDenied />
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => {
    if (t.inputOnly && !canInput) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-sora">OEE — Overall Equipment Effectiveness</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Availability × Performance × Quality — World class: 85%+
              </p>
            </div>
          </div>
          {!isProPlan && (
            <button
              onClick={() => navigate('/app/billing')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800/40 rounded-xl text-xs text-blue-400 hover:bg-blue-900/40 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Factory plan · <span className="font-semibold">Upgrade for full OEE analytics</span></span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'dashboard' && (
            <SectionErrorBoundary section="Dashboard">
              <OEEDashboard onMachineSelect={setSelectedMachine} />
            </SectionErrorBoundary>
          )}

          {activeTab === 'input' && canInput && (
            <SectionErrorBoundary section="Input">
              <div className="max-w-2xl">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
                  <h2 className="font-semibold text-white mb-5">Enter OEE Data</h2>
                  <OEEInputForm isProPlan={isProPlan} />
                </div>
              </div>
            </SectionErrorBoundary>
          )}
        </div>
      </div>

      {/* Machine Detail Sheet */}
      <OEEMachineDetail
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
        isProPlan={isProPlan}
      />
    </div>
  );
}
