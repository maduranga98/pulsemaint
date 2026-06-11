import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageAssessment, TriageAssessmentResult } from '../types';
import { QuizModal } from './QuizModal';

export function AssessmentList() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = user?.uid ?? '';

  const [assessments, setAssessments] = useState<TriageAssessment[]>([]);
  const [results, setResults] = useState<TriageAssessmentResult[]>([]);
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
        where('userId', '==', uid),
      ),
      (snap) =>
        setResults(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageAssessmentResult)),
        ),
    );

    return () => {
      u1();
      u2();
    };
  }, [companyId, uid]);

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
    certified: { label: 'Certified ✅', color: '#22c55e', btn: 'Review' },
    retry: { label: 'Retry 🔁', color: '#f97316', btn: 'Retry Quiz' },
    start: { label: 'Start 📝', color: '#3b82f6', btn: 'Take Quiz' },
  };

  return (
    <div>
      {activeQuiz && (
        <QuizModal assessment={activeQuiz} onClose={() => setActiveQuiz(null)} />
      )}

      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🟡</span>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>
            Quick Assessments
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
            Test your knowledge and earn certifications
          </p>
        </div>
      </div>

      {assessments.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm" style={{ color: '#3d5070' }}>
            No assessments available yet.
          </div>
        </div>
      )}

      <div className="space-y-3">
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
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: '#111d2e', border: '1px solid #1a2840' }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>
                  {a.title}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
                  {a.cat} · Pass mark: {a.passMark}%
                  {lastPct !== null && ` · Last score: ${lastPct}%`}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium hidden sm:block" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <button
                  onClick={() => setActiveQuiz(a)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: meta.color + '1e',
                    color: meta.color,
                    border: `1px solid ${meta.color}40`,
                  }}
                >
                  {meta.btn}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
