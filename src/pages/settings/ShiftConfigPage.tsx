import { useState } from 'react';
import { useShiftConfig } from '@/hooks/useShiftConfig';
import ShiftConfigForm from '@/components/handover/ShiftConfigForm';
import { defaultShiftConfigs, formatTimeRange } from '@/utils/handover.utils';
import { useAuthStore } from '@/store/authStore';
import type { ShiftConfig } from '@/types/handover.types';

export function ShiftConfigPage() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { shifts, loading, save, remove } = useShiftConfig();
  const [editing, setEditing] = useState<ShiftConfig | undefined>(undefined);

  async function seedDefaults() {
    if (!companyId) return;
    for (const shift of defaultShiftConfigs(companyId)) {
      const { shiftName, startTime, endTime, color, activeDays, department, status } = shift;
      await save({ shiftName, startTime, endTime, color, activeDays, department, status, memberIds: [], memberNames: [] });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this shift configuration?')) return;
    await remove(id);
    if (editing?.id === id) setEditing(undefined);
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Shift Configuration</h1>
          <p className="mt-1 text-sm text-slate-500">Admin setup for company shift structure.</p>
        </div>
        <button type="button" onClick={() => void seedDefaults()} className="min-h-12 rounded-md border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700">Seed Defaults</button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-[Sora] text-sm font-bold text-slate-700">{editing ? `Editing: ${editing.shiftName}` : 'Add New Shift'}</h2>
        {editing && (
          <button type="button" onClick={() => setEditing(undefined)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            Cancel edit
          </button>
        )}
      </div>

      <ShiftConfigForm
        key={editing?.id ?? 'new'}
        initial={editing}
        onSave={async (s) => {
          await save(s);
          setEditing(undefined);
        }}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        {loading ? (
          <div className="text-slate-500">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="text-slate-500">No shifts configured yet.</div>
        ) : (
          shifts.map((shift) => (
            <article key={shift.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-[Sora] font-bold text-slate-950">{shift.shiftName}</h2>
                  <p className="text-sm text-slate-500">{formatTimeRange(shift.startTime, shift.endTime)}</p>
                </div>
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: shift.color }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{(shift.activeDays ?? []).join(', ')}</p>
              <p className="text-xs text-slate-500">{shift.department || 'All departments'} - {shift.status}</p>
              {(shift.memberNames ?? []).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(shift.memberNames ?? []).map((name, i) => (
                    <span key={`${name}-${i}`} className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (shift.memberIds ?? []).length > 0 ? (
                <p className="mt-1 text-xs text-slate-400">{(shift.memberIds ?? []).length} member{(shift.memberIds ?? []).length !== 1 ? 's' : ''} assigned</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No members assigned</p>
              )}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditing(shift)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                  Edit
                </button>
                <button type="button" onClick={() => void handleDelete(shift.id)} className="text-sm font-semibold text-red-600 hover:text-red-800">
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default ShiftConfigPage;
