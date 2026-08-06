import { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTraineeLibraryModules } from '@/hooks/training/useTraineeLibraryModules';
import { createTrainingProgram } from '@/services/trainingProgram.service';
import type { ProgramModuleConfig } from '@/types/trainingProgram';

interface CreateProgramModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateProgramModal({ onClose, onCreated }: CreateProgramModalProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const { modules, loading: modulesLoading } = useTraineeLibraryModules({ status: 'active' });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDaysByModule, setDueDaysByModule] = useState<Record<string, number>>({});
  const [totalDurationDays, setTotalDurationDays] = useState(180);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedModuleIds = useMemo(() => Object.keys(dueDaysByModule), [dueDaysByModule]);

  const toggleModule = (moduleId: string) => {
    setDueDaysByModule((prev) => {
      const next = { ...prev };
      if (moduleId in next) delete next[moduleId];
      else next[moduleId] = 30;
      return next;
    });
  };

  const setDueDays = (moduleId: string, days: number) => {
    setDueDaysByModule((prev) => ({ ...prev, [moduleId]: days }));
  };

  const handleSave = async () => {
    if (!title.trim() || selectedModuleIds.length === 0) {
      setError('Add a title and select at least one module.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const moduleConfigs: ProgramModuleConfig[] = selectedModuleIds.map((moduleId) => {
        const mod = modules.find((m) => m.id === moduleId);
        return { moduleId, moduleName: mod?.title ?? '', dueDays: dueDaysByModule[moduleId] };
      });
      await createTrainingProgram(companyId, userId, userName, {
        title: title.trim(),
        description: description.trim(),
        moduleConfigs,
        totalDurationDays,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create program');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Create Training Program</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electrical Trainee Program"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Program Duration *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={totalDurationDays}
                onChange={(e) => setTotalDurationDays(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modules * <span className="text-gray-400 font-normal">(select and set each module's due duration)</span>
            </label>
            {modulesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : modules.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No modules yet — create one in the Modules tab first.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {modules.map((mod) => {
                  const checked = mod.id in dueDaysByModule;
                  return (
                    <div key={mod.id} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleModule(mod.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1 text-sm text-gray-800 truncate">{mod.title}</span>
                      {checked && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={1}
                            value={dueDaysByModule[mod.id]}
                            onChange={(e) => setDueDays(mod.id, Number(e.target.value))}
                            className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500 whitespace-nowrap">days due</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Create Program'}
          </button>
        </div>
      </div>
    </div>
  );
}
