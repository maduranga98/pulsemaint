import { useShiftConfig } from '@/hooks/useShiftConfig';
import ShiftConfigForm from '@/components/handover/ShiftConfigForm';
import { defaultShiftConfigs, formatTimeRange } from '@/utils/handover.utils';
import { useAuthStore } from '@/store/authStore';

export function ShiftConfigPage() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { shifts, loading, save } = useShiftConfig();

  async function seedDefaults() {
    if (!companyId) return;
    for (const shift of defaultShiftConfigs(companyId)) {
      await save(shift);
    }
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
      <ShiftConfigForm onSave={save} />
      <div className="grid gap-3 lg:grid-cols-3">
        {loading ? <div className="text-slate-500">Loading shifts...</div> : shifts.map((shift) => (
          <article key={shift.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-[Sora] font-bold text-slate-950">{shift.shiftName}</h2>
                <p className="text-sm text-slate-500">{formatTimeRange(shift.startTime, shift.endTime)}</p>
              </div>
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: shift.color }} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{shift.activeDays.join(', ')}</p>
            <p className="text-xs text-slate-500">{shift.department || 'All departments'} - {shift.status}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ShiftConfigPage;
