import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { db } from '../../lib/firebase';
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

export default function EditBreakdownPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);

  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<BreakdownSeverity>('medium');
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('mechanical');
  const [description, setDescription] = useState('');
  const [productionImpact, setProductionImpact] = useState('');
  const [currentProductionCount, setCurrentProductionCount] = useState('');
  const [attemptedFixes, setAttemptedFixes] = useState('');
  const [machineStillRunning, setMachineStillRunning] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'breakdown_tickets', id),
      (snap) => {
        if (snap.exists()) {
          const data = { ...snap.data(), id: snap.id } as Breakdown;
          setBreakdown(data);
          setSeverity(data.severity);
          setBreakdownType(data.type);
          setDescription(data.description || '');
          setProductionImpact(data.productionImpact || '');
          setCurrentProductionCount(
            (data as any).currentProductionCount != null ? String((data as any).currentProductionCount) : '',
          );
          setAttemptedFixes(data.attemptedFixes || '');
          setMachineStillRunning(data.machineStillRunning);
        } else {
          setError('Breakdown not found.');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !userProfile) return;
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        severity,
        type: breakdownType,
        description: description.trim(),
        productionImpact: productionImpact.trim(),
        currentProductionCount: currentProductionCount !== '' ? Number(currentProductionCount) : null,
        attemptedFixes: attemptedFixes.trim(),
        machineStillRunning,
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: breakdown?.status || 'reported',
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: new Date().toISOString(),
          note: 'Breakdown details updated',
        }),
      });
      navigate(`/app/breakdowns/${id}`, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error && !breakdown) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700">{error}</p>
          <button onClick={() => navigate('/app/breakdowns')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Back to Breakdowns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <button type="button" onClick={() => navigate(`/app/breakdowns/${id}`)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Edit Breakdown</h1>
        <p className="text-sm text-slate-500">{breakdown?.ticketNumber} — {breakdown?.machineName}</p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
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
            <label className="block text-sm font-medium text-slate-700 mb-2">What happened? *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Production impact</label>
            <input type="text" value={productionImpact} onChange={(e) => setProductionImpact(e.target.value)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Current production count when stopped</label>
            <input type="number" min={0} value={currentProductionCount} onChange={(e) => setCurrentProductionCount(e.target.value)} disabled={saving} className="w-48 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Attempted fixes</label>
            <input type="text" value={attemptedFixes} onChange={(e) => setAttemptedFixes(e.target.value)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={machineStillRunning} onChange={(e) => setMachineStillRunning(e.target.checked)} disabled={saving} className="rounded" />
            Machine is still running (degraded but operational)
          </label>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/app/breakdowns/${id}`)} disabled={saving} className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
