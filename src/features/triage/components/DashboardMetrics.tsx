import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';

export function DashboardMetrics() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = user?.uid ?? '';

  const [openCount, setOpenCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [contentCount, setContentCount] = useState(0);

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

    const u2 = onSnapshot(
      query(
        collection(db, COL.results),
        where('companyId', '==', companyId),
        where('userId', '==', uid),
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

    return () => {
      u1();
      u2();
      u3();
    };
  }, [companyId, uid]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
