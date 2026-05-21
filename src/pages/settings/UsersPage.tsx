import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { AlertCircle, Mail, Phone } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile, UserRole } from '../../types/auth';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  trainee: 'Trainee',
  floor_operator: 'Floor Operator',
};

const STATUS_COLOR: Record<UserProfile['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function UsersPage() {
  const company = useAuthStore((s) => s.company);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);
    const q = query(collection(db, `companies/${company.id}/users`), orderBy('fullName', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProfile));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [company?.id]);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.phone?.toLowerCase().includes(s) ||
      ROLE_LABEL[u.role]?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">{users.length} team members in {company?.name || 'your company'}</p>
      </div>

      <div className="px-6 py-5 space-y-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, or role…"
          className="w-full sm:max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
            <p className="text-5xl mb-3">👥</p>
            <p className="text-slate-500">No users found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                          {(u.fullName?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{u.fullName}</p>
                          {u.jobTitle && <p className="text-xs text-slate-500">{u.jobTitle}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{ROLE_LABEL[u.role] || u.role}</td>
                    <td className="px-4 py-3 space-y-0.5 text-xs text-slate-600">
                      {u.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                        </div>
                      )}
                      {u.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {u.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.lastLoginAt?.toDate ? u.lastLoginAt.toDate().toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
