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

  async function save() {
    await onSave({
      id: initial?.id,
      shiftName,
      startTime,
      endTime,
      color,
      activeDays,
      department: department || null,
      status,
    });
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
      <button type="button" onClick={() => void save()} className="mt-4 min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white">Save Shift</button>
    </form>
  );
}

export default ShiftConfigForm;
