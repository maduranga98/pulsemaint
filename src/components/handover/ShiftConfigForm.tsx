import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { X } from 'lucide-react';
import type { ShiftConfig, ShiftDay } from '@/types/handover.types';
import { useAuthStore } from '@/store/authStore';
import { useDepartments } from '@/hooks/useDepartments';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types/auth';

interface ShiftConfigFormProps {
  onSave: (shift: Omit<ShiftConfig, 'id' | 'companyId'> & { id?: string }) => Promise<void>;
  initial?: ShiftConfig;
}

const DAYS: ShiftDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ShiftConfigForm({ onSave, initial }: ShiftConfigFormProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [shiftName, setShiftName] = useState(initial?.shiftName ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '06:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '14:00');
  const [color, setColor] = useState(initial?.color ?? '#00C2FF');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [activeDays, setActiveDays] = useState<ShiftDay[]>(initial?.activeDays ?? DAYS);
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);

  // Reset local state when switching which shift is being edited.
  useEffect(() => {
    setShiftName(initial?.shiftName ?? '');
    setStartTime(initial?.startTime ?? '06:00');
    setEndTime(initial?.endTime ?? '14:00');
    setColor(initial?.color ?? '#00C2FF');
    setDepartment(initial?.department ?? '');
    setStatus(initial?.status ?? 'active');
    setActiveDays(initial?.activeDays ?? DAYS);
    setMemberIds(initial?.memberIds ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!companyId) return;
    getDocs(query(collection(db, 'users'), where('companyId', '==', companyId), where('status', '==', 'active')))
      .then((snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile))))
      .catch(console.error);
  }, [companyId]);

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
        memberIds,
        memberNames: users.filter((u) => memberIds.includes(u.id)).map((u) => u.fullName ?? ''),
      });
      setSuccess(true);
      if (!initial) {
        setShiftName('');
        setDepartment('');
        setMemberIds([]);
      }
    } catch (err) {
      console.error('Failed to save shift', err);
      setError(err instanceof Error ? err.message : 'Failed to save shift.');
    } finally {
      setSaving(false);
    }
  }

  function toggleMember(uid: string) {
    setMemberIds((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  }

  function removeMember(uid: string) {
    setMemberIds((prev) => prev.filter((id) => id !== uid));
  }

  const selectedUsers = users.filter((u) => memberIds.includes(u.id));
  const unselectedUsers = users.filter((u) => !memberIds.includes(u.id));

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Shift Name
          <input value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="e.g. Morning Shift" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          From
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          To
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="min-h-12 rounded-md border border-slate-200 p-1" />
        <DepartmentPicker value={department} onChange={setDepartment} />
        <select value={status} onChange={(event) => setStatus(event.target.value as ShiftConfig['status'])} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Active Days */}
      <div className="flex flex-wrap gap-2">
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

      {/* Member Assignment */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Assign Members</p>
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedUsers.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                {u.fullName}
                <button type="button" onClick={() => removeMember(u.id)} className="ml-1 text-blue-500 hover:text-blue-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {unselectedUsers.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
            {unselectedUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleMember(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                  {(u.fullName?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{u.fullName}</p>
                  <p className="text-xs text-slate-500 truncate">{u.role} {u.department ? `· ${u.department}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {users.length === 0 && (
          <p className="text-xs text-slate-400">No active users found.</p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && !error && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Shift saved.</div>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Shift'}
      </button>
    </form>
  );
}

function DepartmentPicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { departments, addDepartment } = useDepartments(companyId);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  async function commitAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    await addDepartment(trimmed);
    onChange(trimmed);
    setNewName('');
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="flex min-h-12 items-center gap-2 rounded-md border border-blue-300 bg-white px-2">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commitAdd();
            }
          }}
          placeholder="e.g. Civil, Safety"
          className="flex-1 bg-transparent px-1 text-sm outline-none"
        />
        <button type="button" onClick={() => void commitAdd()} className="rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
          Add
        </button>
        <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__add__') {
          setAdding(true);
          return;
        }
        onChange(e.target.value);
      }}
      className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
    >
      <option value="">All departments</option>
      {departments.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
      <option value="__add__">+ Add new department…</option>
    </select>
  );
}

export default ShiftConfigForm;
