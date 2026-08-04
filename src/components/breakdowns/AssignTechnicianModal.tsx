import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { X, UserPlus } from 'lucide-react';
import { db } from '../../lib/firebase';

interface Candidate {
  id: string;
  fullName: string;
  role: string;
}

interface AssignTechnicianModalProps {
  companyId: string;
  onClose: () => void;
  onAssign: (candidate: Candidate) => void | Promise<void>;
  assigning?: boolean;
}

export function AssignTechnicianModal({ companyId, onClose, onAssign, assigning }: AssignTechnicianModalProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getDocs(query(
      collection(db, 'users'),
      where('companyId', '==', companyId),
      where('role', 'in', ['technician', 'trainee']),
    ))
      .then((snap) => {
        setCandidates(snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, fullName: data.fullName || 'Unnamed', role: data.role };
        }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [companyId]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Assign Technician / Trainee</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Loading team members…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No technicians or trainees found for this company.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4">
            {candidates.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  selectedId === c.id ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-medium text-slate-800">{c.fullName}</span>
                <span className="ml-2 text-xs text-slate-500 capitalize">{c.role}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || assigning}
            onClick={() => selected && onAssign(selected)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {assigning ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
