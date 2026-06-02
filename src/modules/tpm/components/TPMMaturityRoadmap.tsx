import { useMachineMaturity } from '../hooks/useTPM';
import type { TPMMaturityLevel, TPMMachineScore } from '../types/tpm.types';
import { TPM_MATURITY_LABELS, TPM_MATURITY_DESCRIPTIONS } from '../types/tpm.types';
import type { Timestamp } from 'firebase/firestore';

// ─── Level Node ───────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<TPMMaturityLevel, { ring: string; bg: string; text: string; glow: string }> = {
  1: { ring: 'border-red-500', bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/40' },
  2: { ring: 'border-amber-500', bg: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/40' },
  3: { ring: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/40' },
  4: { ring: 'border-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/40' },
};

interface LevelNodeProps {
  level: TPMMaturityLevel;
  isCurrent: boolean;
  count: number;
  isLast: boolean;
}

function LevelNode({ level, isCurrent, count, isLast }: LevelNodeProps) {
  const c = LEVEL_COLORS[level];
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <div className="flex items-center w-full">
        {/* Node circle */}
        <div
          className={`relative flex-shrink-0 h-12 w-12 rounded-full border-2 ${c.ring} flex items-center justify-center
            ${isCurrent ? `${c.bg} shadow-lg ${c.glow} shadow-lg` : 'bg-slate-800'}`}
        >
          <span className={`text-sm font-bold font-sora ${isCurrent ? 'text-white' : c.text}`}>
            {level}
          </span>
          {isCurrent && (
            <span className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full ${c.bg} border-2 border-slate-900 animate-pulse`} />
          )}
        </div>

        {/* Connector line */}
        {!isLast && (
          <div className="flex-1 h-0.5 bg-gradient-to-r from-red-500 via-amber-500 via-blue-500 to-emerald-500 mx-1 opacity-40" />
        )}
      </div>

      {/* Label */}
      <div className="mt-3 text-center px-1">
        <p className={`text-xs font-semibold ${isCurrent ? c.text : 'text-slate-400'}`}>
          {TPM_MATURITY_LABELS[level]}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight hidden sm:block">
          {TPM_MATURITY_DESCRIPTIONS[level].slice(0, 48)}…
        </p>
        {/* Machine count badge */}
        <span
          className={`inline-flex items-center justify-center mt-1.5 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold
            ${count > 0 ? `${c.bg} text-white` : 'bg-slate-700 text-slate-400'}`}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

// ─── Machine Row ──────────────────────────────────────────────────────────────

function MachineRow({ machine }: { machine: TPMMachineScore }) {
  const c = LEVEL_COLORS[machine.maturityLevel];
  const assessed = machine.lastAssessed
    ? (machine.lastAssessed as Timestamp).toDate().toLocaleDateString()
    : '—';

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm text-white font-medium">{machine.machineName}</p>
        <p className="text-[11px] text-slate-500">{machine.machineId}</p>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
            bg-slate-800 ${c.ring} ${c.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${c.bg}`} />
          L{machine.maturityLevel} — {TPM_MATURITY_LABELS[machine.maturityLevel]}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">
        {machine.nextLevelCriteria}
      </td>
      <td className="py-3 px-4 text-xs text-amber-400 hidden lg:table-cell">
        {machine.actionRequired}
      </td>
      <td className="py-3 px-4 text-xs text-slate-500 hidden xl:table-cell">{assessed}</td>
    </tr>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MaturitySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-slate-800/60 rounded-2xl p-6">
        <div className="flex justify-between items-start">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className="h-12 w-12 rounded-full bg-slate-700" />
              <div className="h-3 w-16 bg-slate-700 rounded" />
              <div className="h-5 w-5 bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-800/60 rounded-xl p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-slate-700 rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TPMMaturityRoadmap() {
  const { machines, loading, error, countByLevel } = useMachineMaturity();

  if (loading) return <MaturitySkeleton />;

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400 text-sm">
        Failed to load maturity data: {error}
      </div>
    );
  }

  // Determine dominant current level (most machines)
  const dominantLevel = ([4, 3, 2, 1] as TPMMaturityLevel[]).find(
    (l) => (countByLevel[l] ?? 0) > 0
  ) ?? 1;

  return (
    <div className="space-y-6">
      {/* Roadmap Header */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white font-sora mb-6">
          TPM Maturity Roadmap
        </h3>

        {/* Horizontal Roadmap */}
        <div className="flex items-start w-full">
          {([1, 2, 3, 4] as TPMMaturityLevel[]).map((level, i) => (
            <LevelNode
              key={level}
              level={level}
              isCurrent={level === dominantLevel}
              count={countByLevel[level] ?? 0}
              isLast={i === 3}
            />
          ))}
        </div>
      </div>

      {/* Level Descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([1, 2, 3, 4] as TPMMaturityLevel[]).map((level) => {
          const c = LEVEL_COLORS[level];
          const isActive = level === dominantLevel;
          return (
            <div
              key={level}
              className={`rounded-xl border p-4 transition-all ${
                isActive
                  ? `bg-slate-800 ${c.ring} border-opacity-70`
                  : 'bg-slate-800/40 border-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.bg} text-white`}>
                  L{level}
                </span>
                <span className={`text-xs font-semibold ${isActive ? c.text : 'text-slate-400'}`}>
                  {TPM_MATURITY_LABELS[level]}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {TPM_MATURITY_DESCRIPTIONS[level]}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className={`text-lg font-bold font-sora ${c.text}`}>{countByLevel[level] ?? 0}</span>
                <span className="text-xs text-slate-500">machines</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Machine Maturity Table */}
      {machines.length > 0 ? (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h4 className="text-sm font-semibold text-white">Machine Maturity Details</h4>
            <p className="text-xs text-slate-400 mt-0.5">{machines.length} machine(s) assessed</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Machine
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Level
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
                    Next Level Criteria
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                    Action Required
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                    Last Assessed
                  </th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <MachineRow key={m.machineId} machine={m} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">🏗</span>
          <p className="text-sm font-medium text-slate-300">No machine assessments yet</p>
          <p className="text-xs text-slate-500">Assess machines to populate the maturity roadmap</p>
        </div>
      )}
    </div>
  );
}
