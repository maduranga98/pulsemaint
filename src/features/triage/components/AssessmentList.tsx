import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileEdit, RotateCcw } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageAssessment, TriageAssessmentResult } from '../types';
import { QuizModal } from './QuizModal';

export function AssessmentList() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  // Results are keyed by the member's profile id; accept the auth uid too so
  // results written before this fix still count for their owner.
  const profileId = userProfile?.id ?? '';
  const authUid = user?.uid ?? '';
  const uid = profileId || authUid;

  const [assessments, setAssessments] = useState<TriageAssessment[]>([]);
  const [allResults, setAllResults] = useState<TriageAssessmentResult[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<TriageAssessment | null>(null);

  useEffect(() => {
    if (!companyId || !uid) return;

    const u1 = onSnapshot(
      query(
        collection(db, COL.assessments),
        where('companyId', '==', companyId),
        where('status', '==', 'open'),
      ),
      (snap) =>
        setAssessments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageAssessment)),
        ),
    );

    const u2 = onSnapshot(
      query(
        collection(db, COL.results),
        where('companyId', '==', companyId),
      ),
      (snap) =>
        setAllResults(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageAssessmentResult)),
        ),
    );

    return () => {
      u1();
      u2();
    };
  }, [companyId, uid]);

  // Match only on non-empty ids: legacy results written with an empty/shared
  // userId must never count as "mine" for every member at once.
  const isMine = (r: TriageAssessmentResult) =>
    Boolean(r.userId) &&
    ((profileId !== '' && r.userId === profileId) || (authUid !== '' && r.userId === authUid));
  const results = allResults.filter(isMine);

  function getUserStatus(a: TriageAssessment) {
    const myResults = results.filter((r) => r.assessmentId === a.id);
    if (myResults.some((r) => r.passed)) return 'certified';
    if (myResults.length > 0) return 'retry';
    return 'start';
  }

  function getLastScore(assessmentId: string) {
    const mine = results.filter((r) => r.assessmentId === assessmentId);
    if (!mine.length) return null;
    const sorted = [...mine].sort(
      (a, b) =>
        ((b.completedAt as unknown as { seconds: number })?.seconds ?? 0) -
        ((a.completedAt as unknown as { seconds: number })?.seconds ?? 0),
    );
    return sorted[0];
  }

  const STATUS_META = {
    certified: {
      label: t('common.triage.knowledge.assessmentList.status.certified'),
      icon: CheckCircle2,
      color: '#22c55e',
      btn: t('common.triage.knowledge.assessmentList.button.certified'),
    },
    retry: {
      label: t('common.triage.knowledge.assessmentList.status.retry'),
      icon: RotateCcw,
      color: '#f97316',
      btn: t('common.triage.knowledge.assessmentList.button.retry'),
    },
    start: {
      label: t('common.triage.knowledge.assessmentList.status.start'),
      icon: FileEdit,
      color: '#3b82f6',
      btn: t('common.triage.knowledge.assessmentList.button.start'),
    },
  };

  return (
    <div>
      {activeQuiz && (
        <QuizModal assessment={activeQuiz} onClose={() => setActiveQuiz(null)} />
      )}

      {assessments.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: '#0e1628', border: '1px solid #1f2f4a' }}
        >
          <div className="text-sm" style={{ color: '#6b7fa3' }}>
            {t('common.triage.knowledge.assessmentList.empty')}
          </div>
        </div>
      )}

      <div className="space-y-3 max-w-4xl">
        {assessments.map((a) => {
          const status = getUserStatus(a);
          const meta = STATUS_META[status];
          const last = getLastScore(a.id);
          const lastPct = last
            ? Math.round((last.score / last.total) * 100)
            : null;

          return (
            <div
              key={a.id}
              className="rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4"
              style={{ background: '#0e1628', border: '1px solid #1f2f4a' }}
            >
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: meta.color }}
                >
                  <meta.icon className="w-4 h-4" />
                  {meta.label}
                </span>
                <div className="font-semibold text-[13px] sm:text-sm mt-1" style={{ color: '#e2e8f0' }}>
                  {a.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
                  {a.cat} · {t('common.triage.knowledge.assessmentList.passMark', { value: a.passMark })}
                  {lastPct !== null && ` · ${t('common.triage.knowledge.assessmentList.lastScore', { value: lastPct })}`}
                </div>
              </div>
              <button
                onClick={() => setActiveQuiz(a)}
                className="shrink-0 px-4 min-h-[36px] sm:min-h-[40px] rounded-lg text-[13px] sm:text-sm font-semibold transition-colors"
                style={
                  status === 'start'
                    ? { background: '#2563eb', color: '#ffffff' }
                    : {
                        background: meta.color + '1e',
                        color: meta.color,
                        border: `1px solid ${meta.color}66`,
                      }
                }
              >
                {meta.btn}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
