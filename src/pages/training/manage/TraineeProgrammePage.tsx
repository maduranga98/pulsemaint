import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
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

export default function TraineeProgrammePage() {
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
        toast.error('Pick an end date for a custom duration.');
        return;
      }
      if (!isValidDurationRange(start, new Date(customEndDate))) {
        toast.error('End date must be after the start date.');
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
      toast.success('Training programme created.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create programme');
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
      toast.success('Summary reviewed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to review summary');
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
    if (!programme || !trainee || !userProfile || !recommendation.trim()) return;
    if (!signatureDataUrl) {
      toast.error('Please add your signature to authorize the certificate.');
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
        companyName: company?.name ?? '',
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
      toast.success('Certificate issued.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue certificate');
    } finally {
      setIssuingCert(false);
    }
  }

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm truncate flex-1">
          Training Programme — {trainee?.fullName ?? userId}
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
                {programme.durationMonths}-Month Programme
                <span className="ml-2 text-xs font-normal text-slate-500">{programme.status}</span>
              </h2>
              <div className="space-y-3 mt-3">
                {programme.months.map((m) => (
                  <div key={m.month} className="border border-slate-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-800 mb-1">Month {m.month}{m.title ? ` — ${m.title}` : ''}</p>
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
              <h2 className="font-semibold text-slate-900 mb-3">Knowledge Write-ups</h2>
              {summaries.length === 0 ? (
                <p className="text-sm text-slate-500">No submissions yet.</p>
              ) : (
                <div className="space-y-3">
                  {summaries.map((s) => (
                    <div key={s.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">{s.moduleName || 'Knowledge write-up'}</span>
                        <span className="text-xs text-slate-500">{s.reviewStatus}</span>
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
                            Mark Reviewed
                          </button>
                          <button
                            onClick={() => void handleReview(s.id, 'needs_revision', 'Please add more detail.')}
                            className="text-xs px-2 py-1 bg-amber-600 text-white rounded-md"
                          >
                            Needs Revision
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
                <h2 className="font-semibold text-slate-900 mb-2">Issue Completion Certificate</h2>
                {!allCertified ? (
                  <p className="text-sm text-slate-500">All modules must be certified before a certificate can be issued.</p>
                ) : (
                  <>
                    <textarea
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      rows={3}
                      placeholder="Recommendation from the in-charge (supervisor / admin / plant manager)..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3"
                    />
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Authorizing signature ({userProfile?.fullName})
                      </label>
                      <SignaturePad onChange={setSignatureDataUrl} />
                    </div>
                    <button
                      onClick={() => void handleIssueCertificate()}
                      disabled={issuingCert || !recommendation.trim() || !signatureDataUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {issuingCert ? 'Issuing…' : 'Issue Certificate'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Set Up Training Programme</h2>

            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                <select
                  value={durationPreset}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleDurationPresetChange(v === 'custom' ? 'custom' : (Number(v) as 6 | 12));
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={6}>6 Months</option>
                  <option value={12}>1 Year</option>
                  <option value="custom">Custom range…</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {durationPreset === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
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
                This is a {customMonthCount}-month placement — the plan below has been sized to match.
              </p>
            )}

            <div className="space-y-4">
              {months.map((m, idx) => (
                <div key={m.month} className="border border-slate-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-slate-800 mb-2">Month {m.month}</p>
                  <input
                    type="text"
                    value={m.title}
                    onChange={(e) =>
                      setMonths((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder="Month focus (optional)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm mb-2"
                  />
                  <p className="text-xs font-medium text-slate-500 mb-1">Modules</p>
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
                    placeholder="Weekend tasks for this month, one per line"
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
              {saving ? 'Creating…' : 'Create Programme'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
