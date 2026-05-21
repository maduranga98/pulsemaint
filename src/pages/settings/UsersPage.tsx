import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { AlertCircle, Mail, Phone, Pencil, Eye, UserPlus, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
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

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as UserRole[];
const STATUS_OPTIONS: UserProfile['status'][] = ['active', 'pending', 'inactive'];

const STATUS_COLOR: Record<UserProfile['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
};

type ModalState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'view'; user: UserProfile }
  | { mode: 'edit'; user: UserProfile };

interface UserFormValues {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  jobTitle: string;
  department: string;
  employeeId: string;
  status: UserProfile['status'];
}

const emptyForm: UserFormValues = {
  fullName: '',
  email: '',
  phone: '',
  role: 'technician',
  jobTitle: '',
  department: '',
  employeeId: '',
  status: 'pending',
};

function toForm(u: UserProfile): UserFormValues {
  return {
    fullName: u.fullName ?? '',
    email: u.email ?? '',
    phone: u.phone ?? '',
    role: u.role,
    jobTitle: u.jobTitle ?? '',
    department: u.department ?? '',
    employeeId: u.employeeId ?? '',
    status: u.status,
  };
}

export default function UsersPage() {
  const company = useAuthStore((s) => s.company);
  const currentUserId = useAuthStore((s) => s.userProfile?.id);
  const toast = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

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

  const handleAdd = async (values: UserFormValues) => {
    if (!company?.id) throw new Error('No company in session');
    const id = nanoid();
    const ref = doc(db, `companies/${company.id}/users/${id}`);
    const payload = {
      id,
      companyId: company.id,
      siteIds: [],
      role: values.role,
      fullName: values.fullName.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      employeeId: values.employeeId.trim() || null,
      department: values.department.trim() || null,
      jobTitle: values.jobTitle.trim() || null,
      status: values.status,
      loginMethod: 'email' as const,
      hasPin: false,
      mustChangePinOnLogin: false,
      profilePhoto: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
      invitedBy: currentUserId ?? null,
    };
    await setDoc(ref, payload);
    toast.success(`Added ${values.fullName}`);
  };

  const handleEdit = async (userId: string, values: UserFormValues) => {
    if (!company?.id) throw new Error('No company in session');
    const ref = doc(db, `companies/${company.id}/users/${userId}`);
    await updateDoc(ref, {
      fullName: values.fullName.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      role: values.role,
      jobTitle: values.jobTitle.trim() || null,
      department: values.department.trim() || null,
      employeeId: values.employeeId.trim() || null,
      status: values.status,
      updatedAt: serverTimestamp(),
    });
    toast.success('User updated');
  };

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#1E3A5F] mb-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#F0F4F8] font-[Sora]">Users</h1>
          <p className="text-[13px] text-[#8BA3BF] mt-0.5">
            {users.length} team {users.length === 1 ? 'member' : 'members'} in {company?.name || 'your company'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#1A56DB] text-white hover:bg-[#1E40AF] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="space-y-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, or role…"
          className="w-full sm:max-w-sm px-3 py-2 text-sm rounded-lg outline-none border"
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
            <p className="text-slate-500">
              {users.length === 0
                ? 'No users yet. Click “Add User” to invite your first teammate.'
                : 'No users match your search.'}
            </p>
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
                  <th className="px-4 py-3 text-right">Actions</th>
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
                      {u.lastLoginAt && (u.lastLoginAt as { toDate?: () => Date }).toDate
                        ? (u.lastLoginAt as { toDate: () => Date }).toDate().toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'view', user: u })}
                          title="View"
                          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          title="Edit"
                          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.mode !== 'closed' && (
        <UserModal
          state={modal}
          onClose={() => setModal({ mode: 'closed' })}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}

interface UserModalProps {
  state: Exclude<ModalState, { mode: 'closed' }>;
  onClose: () => void;
  onAdd: (values: UserFormValues) => Promise<void>;
  onEdit: (userId: string, values: UserFormValues) => Promise<void>;
}

function UserModal({ state, onClose, onAdd, onEdit }: UserModalProps) {
  const isView = state.mode === 'view';
  const isAdd = state.mode === 'add';
  const initial: UserFormValues = isAdd ? emptyForm : toForm(state.user);

  const [values, setValues] = useState<UserFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const title = isAdd ? 'Add user' : isView ? 'User details' : 'Edit user';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isView) return;
    if (!values.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!values.email.trim() && !values.phone.trim()) {
      setFormError('Provide an email or phone so the user can sign in.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isAdd) await onAdd(values);
      else await onEdit(state.user.id, values);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-lg border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <Field label="Full name" required>
            <input
              type="text"
              value={values.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              disabled={isView}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email">
              <input
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role">
              <select
                value={values.role}
                onChange={(e) => set('role', e.target.value as UserRole)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={values.status}
                onChange={(e) => set('status', e.target.value as UserProfile['status'])}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job title">
              <input
                type="text"
                value={values.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              />
            </Field>
            <Field label="Department">
              <input
                type="text"
                value={values.department}
                onChange={(e) => set('department', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              />
            </Field>
          </div>

          <Field label="Employee ID">
            <input
              type="text"
              value={values.employeeId}
              onChange={(e) => set('employeeId', e.target.value)}
              disabled={isView}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            />
          </Field>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {isView ? 'Close' : 'Cancel'}
            </button>
            {!isView && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1A56DB] text-white hover:bg-[#1E40AF] disabled:opacity-60"
              >
                {saving ? 'Saving…' : isAdd ? 'Add user' : 'Save changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
