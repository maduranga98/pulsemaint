import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, writeBatch, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { AlertCircle, ArrowLeft, Paperclip, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { db, storage } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown, BreakdownSeverity, BreakdownType } from '../../types/breakdown';

const SEVERITIES: { value: BreakdownSeverity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical — production halted', color: 'bg-red-600 text-white' },
  { value: 'high', label: 'High — major impact', color: 'bg-orange-500 text-white' },
  { value: 'medium', label: 'Medium — minor impact', color: 'bg-amber-500 text-white' },
  { value: 'low', label: 'Low — cosmetic / observation', color: 'bg-slate-400 text-white' },
];

const TYPES: { value: BreakdownType; label: string }[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'software', label: 'Software / Controls' },
  { value: 'other', label: 'Other' },
];

function ReporterField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
        <Lock className="w-3 h-3" />
        {label}
      </p>
      <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
        {value || '—'}
      </p>
    </div>
  );
}

/**
 * A single, shared assessment form for every breakdown ticket reported
 * against one machine — reached from the Breakdowns list's unified
 * Assign/Attend action so a technician attending several tickets on the
 * same machine doesn't have to fill out a separate form per ticket.
 */
export default function AttendBreakdownsPage() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);

  const [tickets, setTickets] = useState<Record<string, Breakdown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<BreakdownSeverity>('medium');
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('mechanical');
  const [attemptedFixes, setAttemptedFixes] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ids.length === 0) {
      setError('No breakdowns specified.');
      setLoading(false);
      return;
    }
    let pending = ids.length;
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'breakdown_tickets', id),
        (snap) => {
          if (snap.exists()) {
            setTickets((prev) => ({ ...prev, [id]: { ...snap.data(), id: snap.id } as Breakdown }));
          }
          pending -= 1;
          if (pending <= 0) setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  const list = ids.map((id) => tickets[id]).filter(Boolean) as Breakdown[];
  const machineName = list[0]?.machineName ?? '';

  // A ticket nobody has taken ownership of yet can't be assessed here either.
  const blocked = !loading && list.length > 0 && list.every((t) => t.status === 'reported');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile || list.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploading(true);
        const siteId = userProfile.siteIds?.[0] || userProfile.companyId;
        uploadedUrls = await Promise.all(
          mediaFiles.map(async (file) => {
            const storagePath = `breakdowns/${siteId}/${list[0].id}/media/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const task = uploadBytesResumable(storageRef, file);
            await new Promise<void>((resolve, reject) => {
              task.on('state_changed', undefined, reject, () => resolve());
            });
            return getDownloadURL(task.snapshot.ref);
          }),
        );
        setUploading(false);
      }

      const batch = writeBatch(db);
      for (const t of list) {
        batch.update(doc(db, 'breakdown_tickets', t.id), {
          severity,
          type: breakdownType,
          attemptedFixes: attemptedFixes.trim(),
          ...(uploadedUrls.length > 0 ? { photos: arrayUnion(...uploadedUrls) } : {}),
          ...(!t.attendedBy ? {
            attendedBy: userProfile.id,
            attendedByName: userProfile.fullName,
            attendedAt: serverTimestamp(),
          } : {}),
          ...(!(t.assignedTechnicianIds ?? []).includes(userProfile.id) ? {
            assignedTechnicianIds: arrayUnion(userProfile.id),
            assignedTechnicianNames: arrayUnion(userProfile.fullName),
          } : {}),
          updatedAt: Timestamp.now(),
          statusHistory: arrayUnion({
            status: t.status,
            changedBy: userProfile.id,
            changedByName: userProfile.fullName,
            changedAt: new Date().toISOString(),
            note: list.length > 1
              ? `Assessed by attending technician alongside ${list.length - 1} other breakdown(s) on ${machineName}.`
              : 'Assessed by attending technician — severity, type, and attempted fixes recorded.',
          }),
        });
      }
      await batch.commit();
      toast.success(list.length > 1 ? `Assessment saved for ${list.length} tickets` : 'Assessment saved');
      // Stays in the Assigned bucket (status is untouched here) — a Work
      // Order is what actually advances it into Open.
      // Back in history rather than a hardcoded /app/breakdowns — a
      // technician reaching this form from the dashboard doesn't even have
      // nav access to that list page, so landing there was a dead end.
      navigate(-1);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error && list.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700">{error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Back to Breakdowns
          </button>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">These breakdowns haven't been assigned yet.</p>
          <p className="text-slate-500 text-sm mt-1">Assign or attend them from the Breakdowns list first.</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Back to Breakdowns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Attend Breakdown{list.length > 1 ? 's' : ''}</h1>
        <p className="text-sm text-slate-500">
          {machineName} — {list.length} ticket{list.length === 1 ? '' : 's'}: {list.map((t) => t.ticketNumber).join(', ')}
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {list.length > 1 ? 'Reported details for each ticket' : 'Reported details'}
          </p>
          {list.map((t) => (
            <div key={t.id} className="border border-slate-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-blue-700">{t.ticketNumber}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.machineStillRunning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {t.machineStillRunning ? 'Still running (degraded)' : 'Stopped'}
                </span>
              </div>
              <ReporterField label="What happened?" value={t.description} />
              {t.productionImpact && <ReporterField label="Production impact" value={t.productionImpact} />}
              {(t as any).currentProductionCount != null && (
                <ReporterField label="Current production count when stopped" value={String((t as any).currentProductionCount)} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {list.length > 1 ? 'Your assessment — applies to all tickets above' : 'Your assessment'}
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Severity *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    severity === s.value ? 'border-blue-600 ring-2 ring-blue-100 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase mr-2 ${s.color}`}>{s.value}</span>
                  <span className="text-slate-700">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Type *</label>
            <select value={breakdownType} onChange={(e) => setBreakdownType(e.target.value as BreakdownType)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Attempted fixes</label>
            <input type="text" value={attemptedFixes} onChange={(e) => setAttemptedFixes(e.target.value)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Attach media (photos/video)</label>
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={saving || uploading}
                onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
                className="text-sm text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-200 file:bg-white file:text-sm file:font-medium hover:file:bg-slate-50"
              />
            </div>
            {mediaFiles.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{mediaFiles.length} file(s) selected{uploading ? ' — uploading…' : ''}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} disabled={saving} className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : list.length > 1 ? `Save Assessment for ${list.length} Tickets` : 'Save Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
}
