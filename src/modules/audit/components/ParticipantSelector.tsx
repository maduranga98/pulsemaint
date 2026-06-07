import { useState, useMemo } from 'react';
import { Search, Check, Users } from 'lucide-react';
import type { UserProfile } from '../../../types/auth';
import type { AuditParticipant } from '../types/audit.types';

interface Props {
  users: UserProfile[];
  selected: AuditParticipant[];
  onChange: (next: AuditParticipant[]) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  floor_operator: 'Operator',
  trainee: 'Trainee',
};

const prettyRole = (r: string) => ROLE_LABELS[r] ?? r;

/** Multi-select attendee panel drawn from the PulseMaint user directory. */
export function ParticipantSelector({ users, selected, onChange }: Props) {
  const [search, setSearch] = useState('');
  const selectedIds = useMemo(() => new Set(selected.map((p) => p.userId)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? users.filter(
          (u) =>
            u.fullName?.toLowerCase().includes(q) ||
            prettyRole(u.role).toLowerCase().includes(q),
        )
      : users;
    return base.slice(0, 60);
  }, [users, search]);

  const toggle = (u: UserProfile) => {
    if (selectedIds.has(u.id)) {
      onChange(selected.filter((p) => p.userId !== u.id));
    } else {
      onChange([...selected, { userId: u.id, name: u.fullName, role: prettyRole(u.role) }]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" /> No participants tagged
          </span>
        )}
        {selected.map((p) => (
          <span
            key={p.userId}
            className="px-2.5 py-1 text-xs bg-slate-700/60 border border-slate-600 text-slate-200 rounded-full"
          >
            {p.name} · {p.role}
          </span>
        ))}
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or role (Electrician, Technician, Supervisor…)"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="max-h-44 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-500">No users found.</p>
        )}
        {filtered.map((u) => {
          const isSel = selectedIds.has(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/60"
            >
              <span>
                <span className="text-sm text-white">{u.fullName}</span>
                <span className="block text-xs text-slate-500">
                  {prettyRole(u.role)} {u.employeeId ? `· #${u.employeeId}` : ''}
                </span>
              </span>
              {isSel && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
