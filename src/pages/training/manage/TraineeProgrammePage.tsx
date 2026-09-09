import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTranslation, type TFunction } from 'react-i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTraineeLibraryModules } from '@/hooks/training/useTraineeLibraryModules';
import { useProgrammeById } from '@/hooks/traineeProgram/useProgrammeById';
import { useWeekendSummaries } from '@/hooks/traineeProgram/useWeekendSummaries';
import {
  createTraineeProgramme,
  ensureModuleAssignments,
  reviewWeekendSummary,
  updateTraineeProgramme,
} from '@/services/traineeProgram.service';
import { issueProgrammeCertificate } from '@/lib/traineeProgram/programmeCertificate';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import { SignaturePad } from '@/components/settings/SignaturePad';
import type { UserProfile } from '@/types/auth';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import type { ProgrammeDurationPreset, ProgrammeMonth } from '@/types/traineeProgram';
import { computeDurationInMonths, isValidDurationRange } from '@/lib/traineeProgram/programmeDuration';

interface MonthDraft {
  month: number;
  title: string;
  moduleIds: string[];
  weekendTasksText: string;
}

function buildDefaultMonths(count: number): MonthDraft[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    month: i + 1,
    title: '',
    moduleIds: [],
    weekendTasksText: '',
  }));
}

function programmeStatusLabel(status: string, t: TFunction): string {
  return t(`common.traineeManagement.traineeProgrammePage.programmeStatuses.${status}`, { defaultValue: status });
}

function reviewStatusLabel(status: string, t: TFunction): string {
  return t(`common.traineeManagement.traineeProgrammePage.reviewStatuses.${status}`, { defaultValue: status });
}

export default function TraineeProgrammePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const companyId = userProfile?.companyId ?? '';

  const [trainee, setTrainee] = useState<UserProfile | null>(null);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [findingProgramme, setFindingProgramme] = useState(true);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);

  const { modules } = useTraineeLibraryModules({ status: 'active' });
  const { programme, loading: programmeLoading } = useProgrammeById(programmeId);
  const { summaries } = useWeekendSummaries(programmeId);

  const [durationPreset, setDurationPreset] = useState<ProgrammeDurationPreset>(6);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState('');
  const [months, setMonths] = useState<MonthDraft[]>(buildDefaultMonths(6));
  const [saving, setSaving] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // The full profile (fullName, email, department, siteIds, …) lives in
    // the per-company subcollection, not the top-level `users` doc (which is
    // only a lightweight uid→companyId/role mapping — see lib/auth.ts).
    // Reading the top-level doc here left traineeName/email/department
    // undefined on the created programme and assignments.
    if (!userId || !companyId) return;
    void getDoc(doc(db, `companies/${companyId}/users/${userId}`)).then((snap) => {
      if (snap.exists()) setTrainee({ id: snap.id, ...snap.data() } as UserProfile);
    });
  }, [userId, companyId]);

  useEffect(() => {
    if (!userId || !companyId) return;
    setFindingProgramme(true);
    const q = query(
      collection(db, 'traineeProgrammes'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; status: string }));
      const active = docs.find((d) => d.status === 'active') ?? docs[0];
      setProgrammeId(active?.id ?? null);
      setFindingProgramme(false);
    });
    return () => unsub();
  }, [userId, companyId]);

  useEffect(() => {
    if (!userId || !companyId) return;
    const q = query(
      collection(db, 'trainingAssignments'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
    });
    return () => unsub();
  }, [userId, companyId]);

  function handleDurationPresetChange(preset: ProgrammeDurationPreset) {
    setDurationPreset(preset);
    if (preset !== 'custom') {
      setMonths(buildDefaultMonths(preset));
    }
  }

  // For a custom range, the month-by-month plan is sized off the approximate
  // month span between start and end date once both are picked.
  const customMonthCount = durationPreset === 'custom' && startDate && customEndDate
    ? computeDurationInMonths(new Date(startDate), new Date(customEndDate))
    : 0;

  function handleApplyCustomRange() {
    if (customMonthCount > 0) {
      setMonths(buildDefaultMonths(customMonthCount));
    }
  }

  function toggleModuleForMonth(monthIndex: number, moduleId: string) {
    setMonths((prev) =>
      prev.map((m, i) =>
        i === monthIndex
          ? {
              ...m,
              moduleIds: m.moduleIds.includes(moduleId)
                ? m.moduleIds.filter((id) => id !== moduleId)
                : [...m.moduleIds, moduleId],
            }
          : m,
      ),
    );
  }

  async function handleCreateProgramme() {
    if (!trainee || !userProfile) return;

    const start = new Date(startDate);
    if (durationPreset === 'custom') {
      if (!customEndDate) {
        toast.error(t('common.traineeManagement.traineeProgrammePage.errors.pickEndDate'));
        return;
      }
      if (!isValidDurationRange(start, new Date(customEndDate))) {
        toast.error(t('common.traineeManagement.traineeProgrammePage.errors.endAfterStart'));
        return;
      }
    }

    setSaving(true);
    try {
      const programmeMonths: ProgrammeMonth[] = months.map((m) => ({
        month: m.month,
        title: m.title,
        moduleIds: m.moduleIds,
        weekendTaskTemplate: m.weekendTasksText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      }));

      const newProgrammeId = await createTraineeProgramme({
        companyId,
        siteId: trainee.siteIds?.[0] ?? companyId,
        traineeId: trainee.id,
        traineeName: trainee.fullName,
        durationPreset,
        startDate: start,
        customEndDate: durationPreset === 'custom' ? new Date(customEndDate) : null,
        months: programmeMonths,
        createdBy: userProfile.id,
        createdByName: userProfile.fullName,
      });

      const selectedModuleIds = new Set(programmeMonths.flatMap((m) => m.moduleIds));
      const selectedModules = modules.filter((m) => selectedModuleIds.has(m.id));
      await ensureModuleAssignments(
        companyId,
        trainee,
        selectedModules,
        userProfile.id,
        userProfile.fullName,
      );

      setProgrammeId(newProgrammeId);
      toast.success(t('common.traineeManagement.traineeProgrammePage.toasts.created'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.traineeManagement.traineeProgrammePage.errors.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(summaryId: string, status: 'reviewed' | 'needs_revision', comments: string) {
    if (!userProfile) return;
    try {
      await reviewWeekendSummary(summaryId, {
        reviewStatus: status,
        reviewComments: comments,
        reviewedBy: userProfile.id,
        reviewedByName: userProfile.fullName,
      });
      toast.success(t('common.traineeManagement.traineeProgrammePage.toasts.summaryReviewed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.traineeManagement.traineeProgrammePage.errors.reviewFailed'));
    }
  }

  const allModuleIds = programme?.months.flatMap((m) => m.moduleIds) ?? [];
  const assignmentByModuleId = new Map(assignments.map((a) => [a.moduleId, a]));
  // A programme module is "done" once the trainee passes its final test.
  // Programme modules are not certified individually (that would mint a
  // per-module certificate) — they sit at `quiz_passed` until the whole
  // programme is signed off here.
  const isModuleDone = (id: string) => {
    const a = assignmentByModuleId.get(id);
    return !!a && (a.quizPassed === true || a.status === 'quiz_passed' || a.status === 'certified');
  };
  const allCertified = allModuleIds.length > 0 && allModuleIds.every(isModuleDone);

  async function handleIssueCertificate() {
    if (!programme || !trainee || !userProfile || !company || !recommendation.trim()) return;
    if (!signatureDataUrl) {
      toast.error(t('common.traineeManagement.traineeProgrammePage.errors.signatureRequired'));
      return;
    }
    setIssuingCert(true);
    try {
      const moduleResults = programme.months.flatMap((m) =>
        m.moduleIds.map((id) => {
          const a = assignmentByModuleId.get(id);
          return { moduleId: id, moduleName: a?.moduleName ?? '', month: m.month, score: a?.bestScore ?? 0 };
        }),
      );
      const finalMark = moduleResults.length > 0
        ? Math.round(moduleResults.reduce((sum, r) => sum + r.score, 0) / moduleResults.length)
        : 0;

      const certificateId = await issueProgrammeCertificate({
        companyId,
        company,
        programmeId: programme.id,
        trainee,
        durationMonths: programme.durationMonths,
        durationPreset: programme.durationPreset ?? programme.durationMonths,
        startDate: programme.startDate.toDate(),
        moduleResults,
        finalMark,
        recommendation: recommendation.trim(),
        recommender: userProfile,
        signatureImageDataUrl: signatureDataUrl,
      });

      await updateTraineeProgramme(programme.id, {
        status: 'completed',
        finalMark,
        certificateId,
        certifiedAt: 'now',
      });
      toast.success(t('common.traineeManagement.traineeProgrammePage.toasts.certificateIssued'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.traineeManagement.traineeProgrammePage.errors.issueCertificateFailed'));
    } finally {
      setIssuingCert(false);
    }
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600" aria-label={t('common.traineeManagement.traineeProgrammePage.backAria')}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm truncate flex-1">
          {t('common.traineeManagement.traineeProgrammePage.headerTitle', { name: trainee?.fullName ?? userId })}
        </h1>
      </div>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {findingProgramme || programmeLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-600" size={28} />
          </div>
        ) : programme ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900 mb-2">
                {t('common.traineeManagement.traineeProgrammePage.monthProgramme', { count: programme.durationMonths })}
                <span className="ml-2 text-xs font-normal text-slate-500">{programmeStatusLabel(programme.status, t)}</span>
              </h2>
              <div className="space-y-3 mt-3">
                {programme.months.map((m) => (
                  <div key={m.month} className="border border-slate-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-800 mb-1">{t('common.traineeManagement.traineeProgrammePage.monthLabel', { number: m.month })}{m.title ? ` — ${m.title}` : ''}</p>
                    <div className="flex flex-wrap gap-2">
                      {m.moduleIds.map((id) => {
                        const a = assignmentByModuleId.get(id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs bg-slate-50 rounded-full px-2 py-1">
                            {a?.moduleName ?? id}
                            {a && <TrainingStatusBadge status={a.status} className="ml-1" />}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900 mb-3">{t('common.traineeManagement.traineeProgrammePage.knowledgeWriteups')}</h2>
              {summaries.length === 0 ? (
                <p className="text-sm text-slate-500">{t('common.traineeManagement.traineeProgrammePage.noSubmissions')}</p>
              ) : (
                <div className="space-y-3">
                  {summaries.map((s) => (
                    <div key={s.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">{s.moduleName || t('common.traineeManagement.traineeProgrammePage.defaultWriteupName')}</span>
                        <span className="text-xs text-slate-500">{reviewStatusLabel(s.reviewStatus, t)}</span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{s.summaryText}</p>
                      {s.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.attachments.map((att) => (
                            <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                              {att.name}
                            </a>
                          ))}
                        </div>
                      )}
                      {s.reviewStatus === 'pending' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => void handleReview(s.id, 'reviewed', '')}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded-md"
                          >
                            {t('common.traineeManagement.traineeProgrammePage.actions.markReviewed')}
                          </button>
                          <button
                            onClick={() => void handleReview(s.id, 'needs_revision', t('common.traineeManagement.traineeProgrammePage.defaultRevisionComment'))}
                            className="text-xs px-2 py-1 bg-amber-600 text-white rounded-md"
                          >
                            {t('common.traineeManagement.traineeProgrammePage.actions.needsRevision')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {programme.status === 'active' && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900 mb-2">{t('common.traineeManagement.traineeProgrammePage.issueCertificate.title')}</h2>
                {!allCertified ? (
                  <p className="text-sm text-slate-500">{t('common.traineeManagement.traineeProgrammePage.issueCertificate.mustCertifyAll')}</p>
                ) : (
                  <>
                    <textarea
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      rows={3}
                      placeholder={t('common.traineeManagement.traineeProgrammePage.issueCertificate.recommendationPlaceholder')}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3"
                    />
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t('common.traineeManagement.traineeProgrammePage.issueCertificate.authorizingSignature', { name: userProfile?.fullName })}
                      </label>
                      <SignaturePad onChange={setSignatureDataUrl} />
                    </div>
                    <button
                      onClick={() => void handleIssueCertificate()}
                      disabled={issuingCert || !recommendation.trim() || !signatureDataUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {issuingCert ? t('common.traineeManagement.traineeProgrammePage.issueCertificate.issuing') : t('common.traineeManagement.traineeProgrammePage.issueCertificate.issue')}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">{t('common.traineeManagement.traineeProgrammePage.setup.title')}</h2>

            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.traineeManagement.traineeProgrammePage.setup.duration')}</label>
                <select
                  value={durationPreset}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleDurationPresetChange(v === 'custom' ? 'custom' : (Number(v) as 6 | 12));
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={6}>{t('common.traineeManagement.traineeProgrammePage.setup.durationOptions.sixMonths')}</option>
                  <option value={12}>{t('common.traineeManagement.traineeProgrammePage.setup.durationOptions.oneYear')}</option>
                  <option value="custom">{t('common.traineeManagement.traineeProgrammePage.setup.durationOptions.custom')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.traineeManagement.traineeProgrammePage.setup.startDate')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {durationPreset === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.traineeManagement.traineeProgrammePage.setup.endDate')}</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    onBlur={handleApplyCustomRange}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            {durationPreset === 'custom' && customMonthCount > 0 && (
              <p className="text-xs text-slate-500">
                {t('common.traineeManagement.traineeProgrammePage.setup.customRangeSized', { count: customMonthCount })}
              </p>
            )}

            <div className="space-y-4">
              {months.map((m, idx) => (
                <div key={m.month} className="border border-slate-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-slate-800 mb-2">{t('common.traineeManagement.traineeProgrammePage.monthLabel', { number: m.month })}</p>
                  <input
                    type="text"
                    value={m.title}
                    onChange={(e) =>
                      setMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder={t('common.traineeManagement.traineeProgrammePage.setup.monthFocusPlaceholder')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm mb-2"
                  />
                  <p className="text-xs font-medium text-slate-500 mb-1">{t('common.traineeManagement.traineeProgrammePage.setup.modules')}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {modules.map((mod) => (
                      <label key={mod.id} className="flex items-center gap-1 text-xs bg-slate-50 rounded-full px-2 py-1">
                        <input
                          type="checkbox"
                          checked={m.moduleIds.includes(mod.id)}
                          onChange={() => toggleModuleForMonth(idx, mod.id)}
                        />
                        {mod.title}
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={m.weekendTasksText}
                    onChange={(e) =>
                      setMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, weekendTasksText: e.target.value } : x)))
                    }
                    rows={2}
                    placeholder={t('common.traineeManagement.traineeProgrammePage.setup.weekendTasksPlaceholder')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => void handleCreateProgramme()}
              disabled={saving}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? t('common.traineeManagement.traineeProgrammePage.setup.creating') : t('common.traineeManagement.traineeProgrammePage.setup.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
