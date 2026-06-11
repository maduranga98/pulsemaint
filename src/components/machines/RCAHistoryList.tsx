import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { RCA } from '../../types/rca';

interface RCAHistoryListProps {
  machineId: string;
}

export function RCAHistoryList({ machineId }: RCAHistoryListProps) {
  const [rcas, setRcas] = useState<RCA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!machineId) return;
    const q = query(
      collection(db, 'rca'),
      where('machineId', '==', machineId),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRcas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RCA)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [machineId]);

  if (loading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Loading RCA records…</div>;
  }

  if (rcas.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No RCA records for this machine.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rcas.map((rca) => (
        <div
          key={rca.id}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {rca.problem.length > 100 ? rca.problem.slice(0, 100) + '…' : rca.problem}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Breakdown: {rca.breakdownId}
              </p>
            </div>
            <span
              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                rca.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {rca.status === 'completed' ? 'Completed' : 'Draft'}
            </span>
          </div>

          {rca.rootCause && (
            <div>
              <span className="text-xs font-medium text-gray-500">Root Cause: </span>
              <span className="text-xs text-gray-800">{rca.rootCause}</span>
            </div>
          )}

          {rca.correctiveAction && (
            <div>
              <span className="text-xs font-medium text-gray-500">Corrective Action: </span>
              <span className="text-xs text-gray-800">{rca.correctiveAction}</span>
            </div>
          )}

          <div className="text-xs text-gray-400">
            {rca.createdAt
              ? new Date(
                  (rca.createdAt as any)?.toMillis?.() ?? Number(rca.createdAt),
                ).toLocaleDateString()
              : '—'}
            {' · '}By {rca.createdByName}
          </div>
        </div>
      ))}
    </div>
  );
}
