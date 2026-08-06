import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useShiftConfig } from '@/hooks/useShiftConfig';
import ShiftConfigForm from '@/components/handover/ShiftConfigForm';
import { defaultShiftConfigs, describeShiftAssignment, formatTimeRange } from '@/utils/handover.utils';
import { useAuthStore } from '@/store/authStore';
import type { ShiftConfig } from '@/types/handover.types';

export function ShiftConfigPage() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const role = useAuthStore((state) => state.userProfile?.role);
  // Mirrors the shift_config delete rule in firestore.rules — plant managers
  // can create and edit shifts, but deletes stay admin-only company-wide.
  const canDelete = role === 'admin';
  const { shifts, loading, save, remove } = useShiftConfig();
  const [editing, setEditing] = useState<ShiftConfig | undefined>(undefined);

  async function seedDefaults() {
    if (!companyId) return;
    for (const shift of defaultShiftConfigs(companyId)) {
      const { shiftName, startTime, endTime, color, activeDays, department, status, assignBy } = shift;
      await save({ shiftName, startTime, endTime, color, activeDays, department, status, memberIds: [], memberNames: [], roles: [], assignBy });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this shift configuration?')) return;
    await remove(id);
    if (editing?.id === id) setEditing(undefined);
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <Link
          to="/app/shift/handover/history"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Shift Handovers
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-[Sora] text-2xl font-bold text-slate-950">Shift Configuration</h1>
            <p className="mt-1 text-sm text-slate-500">Define the shift plans your company runs and who works each one.</p>
          </div>
          <button
            type="button"
            onClick={() => void seedDefaults()}
            className="min-h-12 shrink-0 rounded-md border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Seed Defaults
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-[Sora] text-sm font-bold text-slate-700">
            {editing ? `Editing: ${editing.shiftName}` : 'Add New Shift'}
          </h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="font-[Sora] text-sm font-bold text-slate-700">
          Shift Plans{!loading && shifts.length > 0 ? ` (${shifts.length})` : ''}
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {loading ? (
            <div className="text-sm text-slate-500">Loading shifts…</div>
          ) : shifts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400 lg:col-span-3">
              No shifts configured yet.
            </div>
          ) : (
            shifts.map((shift) => (
              <article key={shift.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-[Sora] text-base font-bold text-slate-950">{shift.shiftName}</h3>
                    <p className="text-sm text-slate-500">{formatTimeRange(shift.startTime, shift.endTime)}</p>
                  </div>
                  <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-slate-200" style={{ backgroundColor: shift.color }} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      shift.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {shift.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  {(shift.activeDays ?? []).map((day) => (
                    <span key={day} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Whichever category the shift assigns by — department, roles,
                    or named employees (see describeShiftAssignment). */}
                <p className="mt-3 text-sm text-slate-600">{describeShiftAssignment(shift)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Individual assignments can also be made in Settings → Users.
                </p>

                <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setEditing(shift)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                    Edit
                  </button>
                  {canDelete && (
                    <button type="button" onClick={() => void handleDelete(shift.id)} className="text-sm font-semibold text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default ShiftConfigPage;
