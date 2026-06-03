import { useState } from 'react';
import { X, Camera, Loader2, AlertTriangle, Clock } from 'lucide-react';
import type { CorrectiveAction, AuditZone } from '../types/fives.types';
import { useAuthStore } from '../../../store/authStore';
import { updateCorrectiveAction, closeCorrectiveAction, uploadAuditPhoto } from '../services/fives.service';

const COLUMNS: { id: CorrectiveAction['status']; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'closed', label: 'Closed' },
];

function today() {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(ca: CorrectiveAction) {
  return ca.status !== 'closed' && ca.dueDate < today();
}

function SeverityBadge({ severity }: { severity: CorrectiveAction['severity'] }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      severity === 'immediate'
        ? 'bg-red-500/20 text-red-400'
        : 'bg-amber-500/20 text-amber-400'
    }`}>
      {severity.toUpperCase()}
    </span>
  );
}

// ─── Slide Panel ──────────────────────────────────────────────────────────────

function CAPanel({
  ca,
  onClose,
  onUpdated,
}: {
  ca: CorrectiveAction;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const plantId = userProfile?.companyId ?? '';
  const canClose = ['supervisor', 'admin', 'plant_manager'].includes(userProfile?.role ?? '');

  const [closureNotes, setClosureNotes] = useState(ca.closureNotes);
  const [photos, setPhotos] = useState<string[]>(ca.closurePhotos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatus = async (status: CorrectiveAction['status']) => {
    setSaving(true);
    try {
      await updateCorrectiveAction(plantId, ca.id, { status });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!closureNotes.trim()) {
      setError('Closure notes are required.');
      return;
    }
    if (photos.length === 0) {
      setError('At least one closure photo is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await closeCorrectiveAction(plantId, ca.id, userProfile?.fullName ?? '', closureNotes, photos);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAuditPhoto(file, plantId, ca.auditId, `ca_${ca.id}`);
      setPhotos((p) => [...p, url]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-md bg-[#0A1628] border-l border-[#1E3A5F] overflow-y-auto p-5 space-y-5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={ca.severity} />
              <span className={`text-xs font-medium ${
                ca.status === 'closed' ? 'text-emerald-400' :
                ca.status === 'in_progress' ? 'text-cyan-400' : 'text-slate-400'
              }`}>{ca.status.replace('_', ' ')}</span>
            </div>
            <h3 className="text-base font-bold text-white font-sora leading-snug">{ca.description}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Zone</span>
            <span className="text-slate-200">{ca.zoneName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Pillar</span>
            <span className="text-slate-200 capitalize">{ca.pillarId.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Due Date</span>
            <span className={isOverdue(ca) ? 'text-red-400 font-semibold' : 'text-slate-200'}>
              {ca.dueDate} {isOverdue(ca) && '⚠ OVERDUE'}
            </span>
          </div>
          {ca.assignedTo && (
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned To</span>
              <span className="text-slate-200">{ca.assignedTo}</span>
            </div>
          )}
        </div>

        {/* Status Actions */}
        {ca.status !== 'closed' && canClose && (
          <div className="space-y-3 pt-2 border-t border-[#1E3A5F]">
            {ca.status === 'open' && (
              <button
                onClick={() => handleStatus('in_progress')}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-cyan-600/20 border border-cyan-600/40 text-cyan-400 text-sm font-semibold hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
              >
                Mark In Progress
              </button>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closure Notes *</label>
              <textarea
                rows={3}
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                placeholder="Describe how the issue was resolved…"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence Photos *</label>
              <div className="flex gap-2 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  </div>
                ))}
                <label className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-500 flex items-center justify-center cursor-pointer hover:bg-blue-500/10 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 text-blue-400 animate-spin" /> : <Camera className="h-5 w-5 text-slate-400" />}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhoto(f);
                    }}
                  />
                </label>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleClose}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Close Action
            </button>
          </div>
        )}

        {ca.status === 'closed' && (
          <div className="pt-2 border-t border-[#1E3A5F] space-y-2">
            <p className="text-xs text-emerald-400 font-semibold">Closed by {ca.closedBy}</p>
            {ca.closureNotes && <p className="text-sm text-slate-300">{ca.closureNotes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

interface CorrectiveActionBoardProps {
  actions: CorrectiveAction[];
  zones?: AuditZone[];
  onRefresh?: () => void;
}

export function CorrectiveActionBoard({ actions, zones = [], onRefresh }: CorrectiveActionBoardProps) {
  const [filterZone, setFilterZone] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selected, setSelected] = useState<CorrectiveAction | null>(null);

  const filtered = actions.filter((ca) => {
    if (filterZone && ca.zoneId !== filterZone) return false;
    if (filterSeverity && ca.severity !== filterSeverity) return false;
    if (overdueOnly && !isOverdue(ca)) return false;
    return true;
  });

  const byStatus = (status: CorrectiveAction['status']) =>
    filtered.filter((ca) => ca.status === status);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {zones.length > 0 && (
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Zones</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        )}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Severity</option>
          <option value="immediate">Immediate</option>
          <option value="standard">Standard</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-slate-600"
          />
          Overdue only
        </label>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} actions</span>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colItems = byStatus(col.id);
          return (
            <div key={col.id} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E3A5F] flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{col.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  col.id === 'open' ? 'bg-red-500/20 text-red-400' :
                  col.id === 'in_progress' ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>{colItems.length}</span>
              </div>

              <div className="p-3 space-y-2 min-h-[200px]">
                {colItems.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-8">No items</p>
                )}
                {colItems.map((ca) => (
                  <div
                    key={ca.id}
                    onClick={() => setSelected(ca)}
                    className={`bg-[#142849] border rounded-xl p-3 cursor-pointer hover:border-blue-500/50 transition-colors space-y-2 ${
                      isOverdue(ca) ? 'border-red-500/40' : 'border-[#1E3A5F]'
                    }`}
                  >
                    <p className="text-xs text-slate-200 leading-snug line-clamp-2">
                      {ca.description}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={ca.severity} />
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        {isOverdue(ca) && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        <Clock className="h-3 w-3" />
                        {ca.dueDate}
                      </span>
                    </div>
                    {ca.zoneName && (
                      <p className="text-[10px] text-slate-500 truncate">{ca.zoneName}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <CAPanel
          ca={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
