import { useState } from 'react';
import type { ShiftConfig, ShiftDay } from '@/types/handover.types';

interface ShiftConfigFormProps {
  onSave: (shift: Omit<ShiftConfig, 'id' | 'companyId'> & { id?: string }) => Promise<void>;
  initial?: ShiftConfig;
}

const DAYS: ShiftDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ShiftConfigForm({ onSave, initial }: ShiftConfigFormProps) {
  const [shiftName, setShiftName] = useState(initial?.shiftName ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '06:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '14:00');
  const [color, setColor] = useState(initial?.color ?? '#00C2FF');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [activeDays, setActiveDays] = useState<ShiftDay[]>(initial?.activeDays ?? DAYS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setError(null);
    setSuccess(false);
    if (!shiftName.trim()) {
      setError('Shift name is required.');
      return;
    }
    if (activeDays.length === 0) {
      setError('Select at least one active day.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        shiftName: shiftName.trim(),
        startTime,
        endTime,
        color,
        activeDays,
        department: department.trim() || null,
        status,
      });
      setSuccess(true);
      if (!initial) {
        setShiftName('');
        setDepartment('');
      }
    } catch (err) {
      console.error('Failed to save shift', err);
      setError(err instanceof Error ? err.message : 'Failed to save shift.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="Shift Name" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="min-h-12 rounded-md border border-slate-200 p-1" />
        <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Department" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value as ShiftConfig['status'])} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {DAYS.map((day) => (
          <label key={day} className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
            <input
              type="checkbox"
              checked={activeDays.includes(day)}
              onChange={(event) => setActiveDays((days) => event.target.checked ? [...days, day] : days.filter((item) => item !== day))}
            />
            {day}
          </label>
        ))}
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && !error && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Shift saved.</div>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Shift'}
      </button>
    </form>
  );
}

export default ShiftConfigForm;
