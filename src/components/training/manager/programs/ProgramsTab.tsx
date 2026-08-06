import { useState } from 'react';
import { Plus, UserPlus, Trash2, GraduationCap } from 'lucide-react';
import { useTrainingPrograms } from '@/hooks/training/useTrainingPrograms';
import { deleteTrainingProgram } from '@/services/trainingProgram.service';
import type { TrainingProgram } from '@/types/trainingProgram';
import CreateProgramModal from './CreateProgramModal';
import AssignProgramModal from './AssignProgramModal';

export default function ProgramsTab() {
  const { programs, loading } = useTrainingPrograms();
  const [showCreate, setShowCreate] = useState(false);
  const [assigningProgram, setAssigningProgram] = useState<TrainingProgram | null>(null);
  const [justAssigned, setJustAssigned] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this program? This permanently removes it from the catalog and cannot be undone. Trainees already assigned to it keep their progress.')) return;
    await deleteTrainingProgram(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Programs</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Create Program
        </button>
      </div>

      {justAssigned && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2.5">
          Program assigned successfully.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <GraduationCap className="w-8 h-8 mb-2" />
            <p className="text-sm">No programs created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Modules</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Total Duration</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{p.title}</span>
                      {p.description && <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.moduleConfigs.length}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.totalDurationDays} days</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.status === 'active' ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === 'active' && (
                          <button
                            onClick={() => {
                              setJustAssigned(false);
                              setAssigningProgram(p);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            <UserPlus className="w-3 h-3" /> Assign
                          </button>
                        )}
                        {p.status === 'active' && (
                          <button
                            onClick={() => void handleDelete(p.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProgramModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
      )}

      {assigningProgram && (
        <AssignProgramModal
          program={assigningProgram}
          onClose={() => setAssigningProgram(null)}
          onAssigned={() => {
            setAssigningProgram(null);
            setJustAssigned(true);
          }}
        />
      )}
    </div>
  );
}
