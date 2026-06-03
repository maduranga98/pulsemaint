import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, CheckCircle, Loader2, FileText } from 'lucide-react';
import type { FiveSAudit, CorrectiveAction } from '../types/fives.types';
import { DEFAULT_CHECKLIST } from '../data/defaultChecklist';
import { useAuthStore } from '../../../store/authStore';
import { verifyAudit } from '../services/fives.service';

const SCORE_LABEL: Record<number, string> = { 0: 'Not Done', 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Excellent' };

function scoreChip(score: number) {
  const colors =
    score >= 3 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    score >= 2 ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
    score >= 1 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
               'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colors}`}>
      {score} — {SCORE_LABEL[score]}
    </span>
  );
}

function overallColor(score: number) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-cyan-400';
  if (score >= 25) return 'text-amber-400';
  return 'text-red-400';
}

interface AuditDetailProps {
  audit: FiveSAudit;
  correctiveActions?: CorrectiveAction[];
  onCAClick?: (ca: CorrectiveAction) => void;
}

export function AuditDetail({ audit, correctiveActions = [], onCAClick }: AuditDetailProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const plantId = userProfile?.companyId ?? '';
  const canVerify =
    audit.status === 'submitted' &&
    ['supervisor', 'admin', 'plant_manager'].includes(userProfile?.role ?? '');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(audit.status === 'verified');

  const togglePillar = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await verifyAudit(plantId, audit.id, userProfile?.fullName ?? '');
      setVerified(true);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white font-sora">{audit.zoneName}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {audit.auditDate} · {audit.shift} shift · by {audit.auditorName}
              {audit.coAuditorName ? ` & ${audit.coAuditorName}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-center flex-shrink-0">
            <span className={`text-4xl font-black font-sora ${overallColor(audit.overallScore)}`}>
              {audit.overallScore}%
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                verified || audit.status === 'verified'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : audit.status === 'submitted'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {verified || audit.status === 'verified' ? 'Verified' : audit.status}
            </span>
          </div>
        </div>

        {/* Pillar mini-scores */}
        <div className="grid grid-cols-5 gap-2">
          {DEFAULT_CHECKLIST.map((pillar) => {
            const ps = (audit.pillarScores as Record<string, number>)[pillar.id] ?? 0;
            const pct = Math.round((ps / 4) * 100);
            return (
              <div key={pillar.id} className="flex flex-col items-center gap-1">
                <span className="text-lg">{pillar.icon}</span>
                <span className={`text-sm font-bold ${overallColor(pct)}`}>{ps.toFixed(1)}</span>
                <span className="text-[10px] text-slate-500">{pillar.name.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {canVerify && !verified && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Verify Audit
            </button>
          )}
          <button
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
            onClick={() => alert('PDF export requires Cloud Function. Coming soon.')}
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Pillar Accordions */}
      <div className="space-y-2">
        {DEFAULT_CHECKLIST.map((pillar) => {
          const isOpen = expanded.has(pillar.id);
          const items = pillar.checklistItems;

          return (
            <div key={pillar.id} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden">
              <button
                onClick={() => togglePillar(pillar.id)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{pillar.icon}</span>
                  <span className="text-sm font-semibold text-white">{pillar.name}</span>
                  <span className={`text-xs font-bold ${overallColor(Math.round(((audit.pillarScores as Record<string, number>)[pillar.id] ?? 0) / 4 * 100))}`}>
                    {((audit.pillarScores as Record<string, number>)[pillar.id] ?? 0).toFixed(1)} / 4
                  </span>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-[#1E3A5F] divide-y divide-[#1E3A5F]">
                  {items.map((ci) => {
                    const sc = audit.itemScores.find((s) => s.checkItemId === ci.id);
                    return (
                      <div key={ci.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-slate-300 flex-1">{ci.description}</p>
                          {sc ? scoreChip(sc.score) : (
                            <span className="text-xs text-slate-600 italic">Not scored</span>
                          )}
                        </div>
                        {sc?.notes && (
                          <p className="text-xs text-slate-400 italic">"{sc.notes}"</p>
                        )}
                        {sc?.photoUrls && sc.photoUrls.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {sc.photoUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-700 hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Corrective Actions */}
      {correctiveActions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Corrective Actions ({correctiveActions.length})
          </h3>
          {correctiveActions.map((ca) => (
            <div
              key={ca.id}
              onClick={() => onCAClick?.(ca)}
              className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-500/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{ca.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    ca.severity === 'immediate'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {ca.severity.toUpperCase()}
                  </span>
                  <span className={`text-xs ${
                    ca.status === 'closed' ? 'text-emerald-400' :
                    ca.status === 'in_progress' ? 'text-cyan-400' : 'text-slate-400'
                  }`}>{ca.status.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">Due: {ca.dueDate}</span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
