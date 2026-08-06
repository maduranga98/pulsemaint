import { useState } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTraineeList } from '@/hooks/training/useTraineeList';
import { assignProgramToTrainee } from '@/services/trainingProgram.service';
import type { TrainingProgram } from '@/types/trainingProgram';

interface AssignProgramModalProps {
  program: TrainingProgram;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignProgramModal({ program, onClose, onAssigned }: AssignProgramModalProps) {
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const [search, setSearch] = useState('');
  const { trainees, loading } = useTraineeList({ searchQuery: search });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const targets = trainees.filter((t) => selectedIds.has(t.id));
      for (const trainee of targets) {
        await assignProgramToTrainee(
          program,
          {
            id: trainee.id,
            fullName: trainee.fullName,
            email: trainee.email,
            role: trainee.role,
            department: trainee.department,
          },
          userId,
          userName
        );
      }
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign program');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Assign Program</h3>
            <p className="text-xs text-gray-500 mt-0.5">{program.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search trainees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : trainees.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No trainees found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {trainees.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800">{t.fullName}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="px-5 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAssign()}
            disabled={saving || selectedIds.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? 'Assigning…' : `Assign to ${selectedIds.size || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
