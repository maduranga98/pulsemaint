import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin, Building2 } from 'lucide-react';
import type { AuditZone, FiveSAudit } from '../types/fives.types';
import { DEFAULT_CHECKLIST } from '../data/defaultChecklist';

interface ZoneCardProps {
  zone: AuditZone;
  recentAudits?: FiveSAudit[];
  openCACount?: number;
  immediateCACount?: number;
  canStartAudit?: boolean;
  isProPlan?: boolean;
  onStartAudit?: (zoneId: string) => void;
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-cyan-400';
  if (score >= 25) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBg(score: number | null): string {
  if (score === null || score === undefined) return 'bg-slate-700/50';
  if (score >= 75) return 'bg-emerald-500/20 border-emerald-500/30';
  if (score >= 50) return 'bg-cyan-500/20 border-cyan-500/30';
  if (score >= 25) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function pillarBarColor(score: number): string {
  if (score >= 3) return 'bg-emerald-500';
  if (score >= 2) return 'bg-cyan-500';
  if (score >= 1) return 'bg-amber-500';
  return 'bg-red-500';
}

function nextAuditDate(zone: AuditZone): string {
  if (!zone.lastAuditDate) return 'Not started';
  const last = new Date(zone.lastAuditDate);
  const next = new Date(last);
  if (zone.auditFrequency === 'daily') next.setDate(next.getDate() + 1);
  else if (zone.auditFrequency === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString().split('T')[0];
}

function isOverdue(zone: AuditZone): boolean {
  const next = nextAuditDate(zone);
  if (next === 'Not started') return false;
  return next < new Date().toISOString().split('T')[0];
}

export function ZoneCard({
  zone,
  recentAudits = [],
  openCACount = 0,
  immediateCACount = 0,
  canStartAudit = false,
  isProPlan = false,
  onStartAudit,
}: ZoneCardProps) {
  const lastAudit = recentAudits[0];

  const pillarAvgs = useMemo(() => {
    if (!lastAudit) return null;
    return lastAudit.pillarScores;
  }, [lastAudit]);

  const trendDir = useMemo(() => {
    if (!isProPlan || recentAudits.length < 2) return null;
    const recent = recentAudits.slice(0, 3).map((a) => a.overallScore);
    const avg1 = recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
    const avg2 = recent.slice(Math.floor(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recent.length / 2);
    if (avg1 > avg2 + 3) return 'up';
    if (avg2 > avg1 + 3) return 'down';
    return 'stable';
  }, [recentAudits, isProPlan]);

  const overdue = isOverdue(zone);
  const nextDue = nextAuditDate(zone);
  const score = zone.lastAuditScore;

  return (
    <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#1A56DB]/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-sora truncate">{zone.name}</h3>
            {isProPlan && trendDir && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${
                trendDir === 'up' ? 'text-emerald-400' :
                trendDir === 'down' ? 'text-red-400' : 'text-slate-400'
              }`}>
                {trendDir === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> :
                 trendDir === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> :
                 <Minus className="h-3.5 w-3.5" />}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {zone.department && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Building2 className="h-3 w-3" />
                {zone.department}
              </span>
            )}
            {zone.floorLocation && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3" />
                {zone.floorLocation}
              </span>
            )}
          </div>
        </div>

        {/* Score Badge */}
        <div className={`flex-shrink-0 w-16 h-16 rounded-xl border flex flex-col items-center justify-center ${scoreBg(score)}`}>
          {score !== null && score !== undefined ? (
            <>
              <span className={`text-2xl font-black font-sora ${scoreColor(score)}`}>
                {score}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">/ 100</span>
            </>
          ) : (
            <span className="text-xs text-slate-500 text-center leading-tight px-1">No audit</span>
          )}
        </div>
      </div>

      {/* Pillar Score Bar */}
      {pillarAvgs ? (
        <div className="space-y-1">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">Pillar Scores</p>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden">
            {DEFAULT_CHECKLIST.map((pillar) => {
              const pScore = (pillarAvgs as Record<string, number>)[pillar.id] ?? 0;
              return (
                <div
                  key={pillar.id}
                  className={`flex-1 ${pillarBarColor(pScore)} rounded-sm`}
                  title={`${pillar.name}: ${pScore.toFixed(1)}/4`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 px-0.5">
            {DEFAULT_CHECKLIST.map((p) => (
              <span key={p.id} className="flex-1 text-center">{p.name.slice(0, 3)}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-2 rounded-full bg-slate-800" />
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs">
        {lastAudit ? (
          <span className="text-slate-400">
            Last: <span className="text-slate-300">{lastAudit.auditDate}</span>
            {' '}by <span className="text-slate-300">{lastAudit.auditorName}</span>
          </span>
        ) : (
          <span className="text-slate-500 italic">No audits yet</span>
        )}
      </div>

      {/* Badges + Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {openCACount > 0 && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
            immediateCACount > 0
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <AlertTriangle className="h-3 w-3" />
            {openCACount} open action{openCACount > 1 ? 's' : ''}
            {immediateCACount > 0 && ` (${immediateCACount} immediate)`}
          </span>
        )}

        {nextDue !== 'Not started' && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            overdue
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
          }`}>
            {overdue ? '⚠ Overdue: ' : 'Due: '}{nextDue}
          </span>
        )}

        {zone.lastAuditDate === null && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            First audit needed
          </span>
        )}
      </div>

      {canStartAudit && (
        <button
          onClick={() => onStartAudit?.(zone.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1A56DB] hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30"
        >
          <ClipboardList className="h-4 w-4" />
          Start Audit
        </button>
      )}
    </div>
  );
}
