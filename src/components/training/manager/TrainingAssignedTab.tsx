import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { useTranslation, type TFunction } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTrainingLibraryModules } from '@/hooks/training/useTrainingLibraryModules';
import { getModuleCategory } from '@/lib/training/offboardTraining';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import {
  TRAINEE_TRAINING_TYPE_LABELS,
  TRAINING_DELIVERY_MODE_LABELS,
} from '@/lib/training/trainingTypes';
import type { TrainingAssignment, TrainingModule } from '@/lib/training/trainingTypes';

function categoryLabel(category: 'machine' | 'offboard', t: TFunction): string {
  return t(`common.trainingShared.manager.trainingAssignedTab.categories.${category}`);
}

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return (ts as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isReadyToSignOff(a: TrainingAssignment): boolean {
  if (a.status === 'certified') return false;
  return a.quizPassed || (a.overallProgress ?? 0) >= 100 || a.status === 'awaiting_practical';
}

export default function TrainingAssignedTab() {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? t('common.trainingShared.manager.trainingAssignedTab.managerFallbackName');
  const { modules } = useTrainingLibraryModules();
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState<TrainingAssignment | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const moduleIds = useMemo(() => new Set(modules.map((m) => m.id)), [modules]);
  const modulesById = useMemo(() => {
    const m = new Map<string, TrainingModule>();
    for (const mod of modules) m.set(mod.id, mod);
    return m;
  }, [modules]);

  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  // Only this library's modules, and only assignments still open — a signed-off
  // and closed (certified) assignment drops off the list entirely.
  const openAssignments = assignments.filter(
    (a) => moduleIds.has(a.moduleId) && a.status !== 'certified'
  );

  const groups = useMemo(() => {
    const byTrainee = new Map<string, { traineeId: string; traineeName: string; rows: TrainingAssignment[] }>();
    for (const a of openAssignments) {
      const g = byTrainee.get(a.traineeId) ?? { traineeId: a.traineeId, traineeName: a.traineeName, rows: [] };
      g.rows.push(a);
      byTrainee.set(a.traineeId, g);
    }
    return [...byTrainee.values()].sort((a, b) => a.traineeName.localeCompare(b.traineeName));
  }, [openAssignments]);

  const handleConfirmSignOff = async () => {
    if (!signingOff) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'trainingAssignments', signingOff.id), {
        practicalSignOff: {
          required: true,
          signedOffBy: userId,
          signedOffByName: userName,
          signedOffAt: serverTimestamp(),
          observations: note,
          passed: true,
        },
        status: 'certified',
        certifiedAt: serverTimestamp(),
        completedAt: signingOff.completedAt ?? serverTimestamp(),
      });
      setSigningOff(null);
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center py-12 text-gray-400">
        <ClipboardList className="w-8 h-8 mb-2" />
        <p className="text-sm">{t('common.trainingShared.manager.trainingAssignedTab.noneOpen')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.traineeId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">{group.traineeName}</h3>
            <span className="text-xs text-gray-400">
              {t('common.trainingShared.manager.trainingAssignedTab.modulesAssigned', { count: group.rows.length })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.module')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.type')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.mode')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.category')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.progress')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.assigned')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.dueDate')}</th>
                  <th className="px-4 py-3 text-left">{t('common.trainingShared.manager.trainingAssignedTab.columns.status')}</th>
                  <th className="px-4 py-3 text-right">{t('common.trainingShared.manager.trainingAssignedTab.columns.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.rows.map((a) => {
                  const mod = modulesById.get(a.moduleId);
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.moduleName}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {mod?.trainingType ? TRAINEE_TRAINING_TYPE_LABELS[mod.trainingType] : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {mod?.trainingMode ? TRAINING_DELIVERY_MODE_LABELS[mod.trainingMode] : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{categoryLabel(getModuleCategory(mod), t)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, a.overallProgress ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{a.overallProgress ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(a.assignedAt)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(a.dueDate)}</td>
                      <td className="px-4 py-3"><TrainingStatusBadge status={a.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {isReadyToSignOff(a) && (
                          <button
                            onClick={() => setSigningOff(a)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.trainingShared.manager.trainingAssignedTab.signOffAndClose')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {signingOff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{t('common.trainingShared.manager.trainingAssignedTab.signOffAndClose')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {signingOff.traineeName} — {signingOff.moduleName}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.trainingShared.manager.trainingAssignedTab.signOffModal.note')}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('common.trainingShared.manager.trainingAssignedTab.signOffModal.notePlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setSigningOff(null);
                  setNote('');
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('common.trainingShared.manager.trainingAssignedTab.signOffModal.cancel')}
              </button>
              <button
                onClick={() => void handleConfirmSignOff()}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? t('common.trainingShared.manager.trainingAssignedTab.signOffModal.signingOff') : t('common.trainingShared.manager.trainingAssignedTab.signOffModal.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
