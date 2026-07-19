import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';

const MANAGER_ROLES = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'hr_officer', 'admin'];

export function DashboardMetrics() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  // Same identity keys as QuizModal/AssessmentList: auth uid is the primary
  // key, profile id kept for results written before that fix.
  const uid = user?.uid ?? userProfile?.id ?? '';
  const legacyUid = userProfile?.id ?? '';
  const isManager = MANAGER_ROLES.includes(userProfile?.role ?? '');

  const [openCount, setOpenCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [contentCount, setContentCount] = useState(0);
  const [teamStats, setTeamStats] = useState<{ attempts: number; avgPct: number; passed: number } | null>(null);

  useEffect(() => {
    if (!companyId || !uid) return;

    let allAssessmentIds: string[] = [];
    let passedIds = new Set<string>();

    function recompute() {
      const completed = allAssessmentIds.filter((id) => passedIds.has(id));
      setCompletedCount(completed.length);
      setOpenCount(allAssessmentIds.length - completed.length);
    }

    const u1 = onSnapshot(
      query(
        collection(db, COL.assessments),
        where('companyId', '==', companyId),
        where('status', '==', 'open'),
      ),
      (snap) => {
        allAssessmentIds = snap.docs.map((d) => d.id);
        recompute();
      },
    );

    const myIds = [...new Set([uid, legacyUid].filter(Boolean))];
    const u2 = onSnapshot(
      query(
        collection(db, COL.results),
        where('companyId', '==', companyId),
        where('userId', 'in', myIds),
        where('passed', '==', true),
      ),
      (snap) => {
        passedIds = new Set(snap.docs.map((d) => d.data().assessmentId as string));
        recompute();
      },
    );

    const u3 = onSnapshot(
      query(collection(db, COL.content), where('companyId', '==', companyId)),
      (snap) => setContentCount(snap.size),
    );

    // Managers/admins additionally see the whole team's quick-assessment
    // marks summarized right on the Triage dashboard.
    let u4: (() => void) | undefined;
    if (isManager) {
      u4 = onSnapshot(
        query(collection(db, COL.results), where('companyId', '==', companyId)),
        (snap) => {
          let attempts = 0;
          let pctSum = 0;
          let passed = 0;
          snap.docs.forEach((d) => {
            const data = d.data() as { score?: number; total?: number; passed?: boolean };
            const total = Number(data.total ?? 0);
            if (total <= 0) return;
            attempts += 1;
            pctSum += (Number(data.score ?? 0) / total) * 100;
            if (data.passed) passed += 1;
          });
          setTeamStats({
            attempts,
            avgPct: attempts > 0 ? Math.round(pctSum / attempts) : 0,
            passed,
          });
        },
        () => setTeamStats(null),
      );
    }

    return () => {
      u1();
      u2();
      u3();
      u4?.();
    };
  }, [companyId, uid, legacyUid, isManager]);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Open Assessments"
          value={openCount}
          color="#f97316"
          icon="📋"
          desc="Require your attention"
        />
        <MetricCard
          label="Completed Assessments"
          value={completedCount}
          color="#22c55e"
          icon="✅"
          desc="Certifications earned"
        />
        <MetricCard
          label="Content Items"
          value={contentCount}
          color="#3b82f6"
          icon="📚"
          desc="Knowledge base articles"
        />
      </div>
      {isManager && teamStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Team Quiz Attempts"
            value={teamStats.attempts}
            color="#a855f7"
            icon="🧑‍🤝‍🧑"
            desc="Quick-assessment attempts across all members"
          />
          <MetricCard
            label="Team Average Mark"
            value={teamStats.avgPct}
            color="#06b6d4"
            icon="📊"
            desc="Average score (%) across all attempts"
          />
          <MetricCard
            label="Passed Attempts"
            value={teamStats.passed}
            color="#22c55e"
            icon="🏅"
            desc="Attempts that met the pass mark"
          />
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  icon,
  desc,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#111d2e', border: '1px solid #1a2840' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
          style={{ background: color + '1e', color }}
        >
          {icon}
        </div>
        <span className="text-sm" style={{ color: '#6b7fa3' }}>
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold" style={{ color: '#e2e8f0' }}>
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: '#3d5070' }}>
        {desc}
      </div>
    </div>
  );
}
