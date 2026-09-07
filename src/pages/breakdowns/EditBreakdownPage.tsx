import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, Timestamp, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { AlertCircle, ArrowLeft, Paperclip, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { db, storage } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown, BreakdownSeverity, BreakdownType } from '../../types/breakdown';

function getSeverities(t: TFunction): { value: BreakdownSeverity; label: string; color: string }[] {
  return [
    { value: 'critical', label: t('common.breakdowns.attendPage.severities.critical'), color: 'bg-red-600 text-white' },
    { value: 'high', label: t('common.breakdowns.attendPage.severities.high'), color: 'bg-orange-500 text-white' },
    { value: 'medium', label: t('common.breakdowns.attendPage.severities.medium'), color: 'bg-amber-500 text-white' },
    { value: 'low', label: t('common.breakdowns.attendPage.severities.low'), color: 'bg-slate-400 text-white' },
  ];
}

function getTypes(t: TFunction): { value: BreakdownType; label: string }[] {
  return [
    { value: 'mechanical', label: t('common.breakdowns.attendPage.types.mechanical') },
    { value: 'electrical', label: t('common.breakdowns.attendPage.types.electrical') },
    { value: 'hydraulic', label: t('common.breakdowns.attendPage.types.hydraulic') },
    { value: 'pneumatic', label: t('common.breakdowns.attendPage.types.pneumatic') },
    { value: 'software', label: t('common.breakdowns.attendPage.types.software') },
    { value: 'other', label: t('common.breakdowns.attendPage.types.other') },
  ];
}

// Read-only display of a field the reporter filled in — the attending
// technician can see it but must not be able to change it.
function ReporterField({ label, value, t }: { label: string; value: string; t: TFunction }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mb-2">
        <Lock className="w-3.5 h-3.5" />
        {label} <span className="text-xs font-normal text-slate-400">— {t('common.breakdowns.editPage.viewOnly')}</span>
      </label>
      <p className="w-full px-4 py-2 border border-slate-200 bg-slate-50 text-slate-700 rounded-lg whitespace-pre-wrap">
        {value || '—'}
      </p>
    </div>
  );
}

export default function EditBreakdownPage() {
  const { t } = useTranslation();
  const SEVERITIES = getSeverities(t);
  const TYPES = getTypes(t);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);

  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<BreakdownSeverity>('medium');
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('mechanical');
  const [attemptedFixes, setAttemptedFixes] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'breakdown_tickets', id),
      (snap) => {
        if (snap.exists()) {
          const data = { ...snap.data(), id: snap.id } as Breakdown;
          setBreakdown(data);
          setSeverity(data.severity ?? 'medium');
          setBreakdownType(data.type ?? 'mechanical');
          setAttemptedFixes(data.attemptedFixes || '');
        } else {
          setError(t('common.breakdowns.editPage.notFound'));
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
    if (!id || !userProfile || !breakdown) return;
    setSaving(true);
    setError(null);
    try {
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploading(true);
        const siteId = userProfile.siteIds?.[0] || userProfile.companyId;
        uploadedUrls = await Promise.all(
          mediaFiles.map(async (file) => {
            const storagePath = `breakdowns/${siteId}/${id}/media/${Date.now()}_${file.name}`;
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

      // Filling in this assessment does NOT advance the breakdown's status —
      // it stays "assigned" (i.e. the Open bucket / progress bar) until an
      // actual Work Order is created for it (see ViewBreakdownPage's Create
      // Work Order action, which is what really starts the repair).
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        severity,
        type: breakdownType,
        attemptedFixes: attemptedFixes.trim(),
        ...(uploadedUrls.length > 0 ? { photos: arrayUnion(...uploadedUrls) } : {}),
        ...(!breakdown.attendedBy ? {
          attendedBy: userProfile.id,
          attendedByName: userProfile.fullName,
          attendedAt: serverTimestamp(),
        } : {}),
        ...(!(breakdown.assignedTechnicianIds ?? []).includes(userProfile.id) ? {
          assignedTechnicianIds: arrayUnion(userProfile.id),
          assignedTechnicianNames: arrayUnion(userProfile.fullName),
        } : {}),
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: breakdown.status,
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: new Date().toISOString(),
          note: t('common.breakdowns.attendPage.notes.assessedSolo'),
        }),
      });
      navigate(`/app/breakdowns/${id}`, { replace: true });
    } catch (err: any) {
      setError(err?.message || t('common.breakdowns.editPage.errors.saveFailed'));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">{t('common.breakdowns.editPage.loading')}</p>
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
            {t('common.breakdowns.editPage.backToBreakdowns')}
          </button>
        </div>
      </div>
    );
  }

  // A breakdown that hasn't been assigned/attended yet belongs to nobody —
  // it must not be editable until someone takes ownership of it.
  if (breakdown && breakdown.status === 'reported') {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">{t('common.breakdowns.editPage.notYetAssigned')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('common.breakdowns.editPage.assignFirst')}</p>
          <button onClick={() => navigate(`/app/breakdowns/${id}`)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            {t('common.breakdowns.editPage.viewBreakdown')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <button type="button" onClick={() => navigate(`/app/breakdowns/${id}`)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1">
          <ArrowLeft className="w-4 h-4" /> {t('common.breakdowns.editPage.back')}
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{t('common.breakdowns.editPage.title')}</h1>
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
          <ReporterField label={t('common.breakdowns.attendPage.whatHappenedLabel')} value={breakdown?.description ?? ''} t={t} />
          <ReporterField label={t('common.breakdowns.attendPage.productionImpactLabel')} value={breakdown?.productionImpact ?? ''} t={t} />
          <ReporterField
            label={t('common.breakdowns.attendPage.productionCountLabel')}
            value={
              (breakdown as any)?.currentProductionCount != null
                ? String((breakdown as any).currentProductionCount)
                : ''
            }
            t={t}
          />
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-500 mb-2">
              <Lock className="w-3.5 h-3.5" />
              {t('common.breakdowns.editPage.statusLabel')} <span className="text-xs font-normal text-slate-400">— {t('common.breakdowns.editPage.viewOnly')}</span>
            </label>
            <p className={`inline-block px-2 py-1 rounded text-xs font-medium ${breakdown?.machineStillRunning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {breakdown?.machineStillRunning ? t('common.breakdowns.editPage.stillRunning') : t('common.breakdowns.editPage.stopped')}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.breakdowns.attendPage.severityLabel')}</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.breakdowns.attendPage.typeLabel')}</label>
            <select value={breakdownType} onChange={(e) => setBreakdownType(e.target.value as BreakdownType)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              {TYPES.map((ty) => <option key={ty.value} value={ty.value}>{ty.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.breakdowns.attendPage.attemptedFixesLabel')}</label>
            <input type="text" value={attemptedFixes} onChange={(e) => setAttemptedFixes(e.target.value)} disabled={saving} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('common.breakdowns.attendPage.attachMediaLabel')}</label>
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
              <p className="text-xs text-slate-500 mt-1">
                {t('common.breakdowns.attendPage.filesSelected', { count: mediaFiles.length })}
                {uploading ? ` — ${t('common.breakdowns.attendPage.uploading')}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/app/breakdowns/${id}`)} disabled={saving} className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50">
            {t('common.breakdowns.attendPage.cancel')}
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">
            {saving ? t('common.breakdowns.attendPage.saving') : t('common.breakdowns.attendPage.saveAssessment')}
          </button>
        </div>
      </form>
    </div>
  );
}
