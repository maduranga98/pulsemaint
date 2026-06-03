import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle } from 'lucide-react';
import type { AuditZone, FiveSAudit } from '../types/fives.types';
import { DEFAULT_CHECKLIST } from '../data/defaultChecklist';

function heatColor(score: number | null): string {
  if (score === null) return 'bg-slate-800/50 text-slate-600';
  if (score >= 3) return 'bg-emerald-500/20 text-emerald-400';
  if (score >= 2) return 'bg-cyan-500/20 text-cyan-400';
  if (score >= 1) return 'bg-amber-500/20 text-amber-400';
  return 'bg-red-500/20 text-red-400';
}

function overallColor(score: number) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-cyan-400';
  if (score >= 25) return 'text-amber-400';
  return 'text-red-400';
}

interface FiveSZoneSnapshot {
  zone: AuditZone;
  lastAudit?: FiveSAudit;
  prevAudit?: FiveSAudit;
}

interface FiveSScorecardsProps {
  snapshots: FiveSZoneSnapshot[];
  factoryScore: number;
}

export function FiveSScorecard({ snapshots, factoryScore }: FiveSScorecardsProps) {
  const { bestZone, worstZone, momChange } = useMemo(() => {
    const withScores = snapshots.filter((s) => s.zone.lastAuditScore !== null);
    if (!withScores.length) return { bestZone: null, worstZone: null, momChange: 0 };

    const sorted = [...withScores].sort(
      (a, b) => (b.zone.lastAuditScore ?? 0) - (a.zone.lastAuditScore ?? 0),
    );

    const improvements = withScores
      .filter((s) => s.lastAudit && s.prevAudit)
      .map((s) => (s.lastAudit!.overallScore - s.prevAudit!.overallScore));

    const avg = improvements.length
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0;

    return {
      bestZone: sorted[0],
      worstZone: sorted[sorted.length - 1],
      momChange: Number(avg.toFixed(1)),
    };
  }, [snapshots]);

  // Gauge arc (simple SVG)
  const gaugePct = Math.min(factoryScore, 100);
  const gaugeAngle = (gaugePct / 100) * 180 - 90;
  const rad = (gaugeAngle * Math.PI) / 180;
  const cx = 80, cy = 80, r = 55;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  return (
    <div className="space-y-6">
      {/* Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Factory Score Gauge */}
        <div className="col-span-2 bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-5 flex flex-col items-center gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Factory 5S Score</p>
          <svg viewBox="0 0 160 100" className="w-36">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1E3A5F" strokeWidth="10" strokeLinecap="round" />
            {gaugePct > 0 && (
              <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${gaugePct > 50 ? 1 : 0} 1 ${x} ${y}`}
                fill="none"
                stroke={factoryScore >= 75 ? '#10B981' : factoryScore >= 50 ? '#00C2FF' : factoryScore >= 25 ? '#F59E0B' : '#EF4444'}
                strokeWidth="10"
                strokeLinecap="round"
              />
            )}
            <text x={cx} y={cy - 5} textAnchor="middle" className="fill-white font-black" fontSize="22" fontFamily="system-ui">
              {factoryScore}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" className="fill-slate-400" fontSize="9" fontFamily="system-ui">
              / 100
            </text>
          </svg>
        </div>

        {/* MoM */}
        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-xs text-slate-400">Month-over-Month</p>
          <div className="flex items-center gap-1.5 mt-auto">
            {momChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
            <span className={`text-2xl font-black font-sora ${momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {momChange >= 0 ? '+' : ''}{momChange}%
            </span>
          </div>
        </div>

        {/* Best / Worst */}
        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-4 space-y-3">
          {bestZone && (
            <div className="flex items-start gap-2">
              <Award className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Best Zone</p>
                <p className="text-xs font-semibold text-emerald-400">{bestZone.zone.name}</p>
                <p className="text-xs text-slate-400">{bestZone.zone.lastAuditScore}%</p>
              </div>
            </div>
          )}
          {worstZone && worstZone.zone.id !== bestZone?.zone.id && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Needs Attention</p>
                <p className="text-xs font-semibold text-red-400">{worstZone.zone.name}</p>
                <p className="text-xs text-slate-400">{worstZone.zone.lastAuditScore}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Heat Map */}
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E3A5F]">
          <p className="text-sm font-semibold text-white">Zone × Pillar Heat Map</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1E3A5F]">
                <th className="text-left px-4 py-2.5 text-slate-400 font-medium min-w-[140px]">Zone</th>
                {DEFAULT_CHECKLIST.map((p) => (
                  <th key={p.id} className="px-3 py-2.5 text-slate-400 font-medium text-center min-w-[80px]">
                    <span>{p.icon}</span>
                    <br />
                    {p.name.slice(0, 4)}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-slate-400 font-medium text-center min-w-[70px]">Overall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {snapshots.map(({ zone, lastAudit }) => (
                <tr key={zone.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-200 truncate max-w-[130px]">{zone.name}</p>
                    <p className="text-slate-500 text-[10px]">{zone.department}</p>
                  </td>
                  {DEFAULT_CHECKLIST.map((pillar) => {
                    const ps = lastAudit
                      ? ((lastAudit.pillarScores as Record<string, number>)[pillar.id] ?? null)
                      : null;
                    return (
                      <td key={pillar.id} className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${heatColor(ps)}`}>
                          {ps !== null ? ps.toFixed(1) : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-sm font-black font-sora ${overallColor(zone.lastAuditScore ?? 0)}`}>
                      {zone.lastAuditScore !== null ? `${zone.lastAuditScore}%` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
