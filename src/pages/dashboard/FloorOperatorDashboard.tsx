import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMachines } from '../../hooks/useMachines';
import { MachineStatusBadge } from '../../components/machines';

export default function FloorOperatorDashboard() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Operator';
  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const department = userProfile?.department ?? null;

  const { machines, loading } = useMachines({ siteId, pageSize: 100 });

  // Floor operators see the machines on their line/department first.
  const myMachines = useMemo(() => {
    if (!department) return machines;
    const inDept = machines.filter((m) => m.department === department);
    return inDept.length > 0 ? inDept : machines;
  }, [machines, department]);

  const down = myMachines.filter((m) => m.status === 'under_maintenance').length;

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Machines</h1>
          <p className="text-sm text-slate-500">
            Good {getGreeting()}, {firstName}
            {department ? ` · ${department}` : ''}
          </p>
        </div>
        <Link
          to="/app/breakdowns/report"
          className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
        >
          <AlertTriangle className="w-4 h-4" /> Report Breakdown
        </Link>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Machines" value={loading ? '—' : myMachines.length} />
          <Stat label="Running" value={loading ? '—' : myMachines.filter((m) => m.status === 'active').length} />
          <Stat label="Under Maintenance" value={loading ? '—' : down} accent={down > 0 ? 'amber' : undefined} />
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading machines…</p>
        ) : myMachines.length === 0 ? (
          <p className="text-sm text-slate-400">No machines found for your line.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myMachines.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/app/machines/${m.id}`)}
                className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {[m.department, m.bay, m.station].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <MachineStatusBadge status={m.status} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Health</span>
                  <span
                    className={`text-sm font-semibold ${
                      (m.healthScore ?? 100) >= 70
                        ? 'text-emerald-600'
                        : (m.healthScore ?? 100) >= 40
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {m.healthScore ?? '—'}
                  </span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-red-600">
                  <Plus className="w-3 h-3" /> Tap to view / report issue
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'amber' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
