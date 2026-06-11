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
import {
  AlertCircle,
  Mail,
  Phone,
  Pencil,
  Eye,
  UserPlus,
  X,
  Send,
  Copy,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../hooks/useToast';
import { useShiftConfig } from '../../hooks/useShiftConfig';
import {
  createInvitation,
  getCompanyInvitations,
  revokeInvitation,
  resendInvitation,
  getInviteLink,
} from '../../lib/invitations';
import type { UserProfile, UserRole, Invitation } from '../../types/auth';
import { UsersBulkImportModal, type ParsedUserRow } from '../../components/settings/UsersBulkImportModal';
import { Upload } from 'lucide-react';

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

const INVITE_STATUS_COLOR: Record<Invitation['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-slate-100 text-slate-500',
  revoked: 'bg-red-50 text-red-600',
};

type ModalState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'view'; user: UserProfile }
  | { mode: 'edit'; user: UserProfile }
  | { mode: 'invite' };

type TabState = 'users' | 'invitations';

interface UserFormValues {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  jobTitle: string;
  department: string;
  employeeId: string;
  shiftId: string;
  status: UserProfile['status'];
}

interface InviteFormValues {
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
  jobTitle: string;
}

const emptyForm: UserFormValues = {
  fullName: '',
  email: '',
  phone: '',
  role: 'technician',
  jobTitle: '',
  department: '',
  employeeId: '',
  shiftId: '',
  status: 'pending',
};

const emptyInviteForm: InviteFormValues = {
  email: '',
  fullName: '',
  role: 'technician',
  department: '',
  jobTitle: '',
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
    shiftId: u.shiftId ?? '',
    status: u.status,
  };
}

export default function UsersPage() {
  const company = useAuthStore((s) => s.company);
  const currentUser = useAuthStore((s) => s.userProfile);
  const toast = useToast();
  const { shifts } = useShiftConfig();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabState>('users');

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

  useEffect(() => {
    if (!company?.id || activeTab !== 'invitations') return;
    loadInvitations();
  }, [company?.id, activeTab]);

  const loadInvitations = async () => {
    if (!company?.id) return;
    try {
      const data = await getCompanyInvitations(company.id);
      setInvitations(data);
    } catch (err: any) {
      toast.error('Failed to load invitations');
    }
  };

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

  const filteredInvitations = invitations.filter((inv) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      inv.email?.toLowerCase().includes(s) ||
      inv.fullName?.toLowerCase().includes(s) ||
      ROLE_LABEL[inv.role]?.toLowerCase().includes(s)
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
      shiftId: values.shiftId || null,
      status: values.status,
      loginMethod: 'email' as const,
      hasPin: false,
      mustChangePinOnLogin: false,
      profilePhoto: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
      invitedBy: currentUser?.id ?? null,
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
      shiftId: values.shiftId || null,
      status: values.status,
      updatedAt: serverTimestamp(),
    });
    toast.success('User updated');
  };

  const handleInvite = async (values: InviteFormValues) => {
    if (!company?.id || !currentUser) throw new Error('No company in session');
    const inv = await createInvitation({
      companyId: company.id,
      companyName: company.name,
      email: values.email,
      role: values.role,
      fullName: values.fullName,
      department: values.department.trim() || null,
      jobTitle: values.jobTitle.trim() || null,
      invitedBy: currentUser.id,
      invitedByName: currentUser.fullName,
    });
    toast.success(`Invitation sent to ${values.email}`);
    if (activeTab === 'invitations') loadInvitations();
    return inv;
  };

  const handleBulkImport = async (rows: ParsedUserRow[]) => {
    if (!company?.id || !currentUser) throw new Error('No company in session');
    let created = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        await createInvitation({
          companyId: company.id,
          companyName: company.name,
          email: row.email,
          role: row.role,
          fullName: row.fullName,
          department: row.department,
          jobTitle: row.jobTitle,
          invitedBy: currentUser.id,
          invitedByName: currentUser.fullName,
        });
        created += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${row.email}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    if (created > 0) toast.success(`${created} invitation(s) created`);
    if (activeTab === 'invitations') loadInvitations();
    return { created, failed, errors };
  };

  const handleRevoke = async (inv: Invitation) => {
    if (!company?.id) return;
    try {
      await revokeInvitation(company.id, inv.id);
      toast.success('Invitation revoked');
      loadInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    }
  };

  const handleResend = async (inv: Invitation) => {
    if (!company?.id) return;
    try {
      await resendInvitation(company.id, inv.id);
      toast.success('New invitation created');
      loadInvitations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend');
    }
  };

  return (
    <div className="min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#1E3A5F] mb-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#F0F4F8] font-[Sora]">Team Management</h1>
          <p className="text-[13px] text-[#8BA3BF] mt-0.5">
            {users.length} team {users.length === 1 ? 'member' : 'members'} in {company?.name || 'your company'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Users
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'invite' })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Invite Member
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'add' })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#1A56DB] text-white hover:bg-[#1E40AF] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex border-b border-[#1E3A5F]">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-[#00C2FF] border-b-2 border-[#00C2FF]'
                  : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'invitations'
                  ? 'text-[#00C2FF] border-b-2 border-[#00C2FF]'
                  : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              Invitations ({invitations.filter((i) => i.status === 'pending').length} pending)
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'users' ? 'Search by name, email, phone, or role...' : 'Search invitations...'}
            className="w-full sm:max-w-sm px-3 py-2 text-sm rounded-lg outline-none border"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'users' && (
          <>
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
                    ? 'No users yet. Click "Invite Member" to invite your first teammate.'
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
                      <th className="px-4 py-3 text-left">Shifts</th>
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
                        <td className="px-4 py-3">
                          <UserShiftChips
                            userDepartment={u.department ?? null}
                            shifts={shifts}
                          />
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
          </>
        )}

        {activeTab === 'invitations' && (
          <>
            {filteredInvitations.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
                <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">
                  {invitations.length === 0
                    ? 'No invitations sent yet. Click "Invite Member" to get started.'
                    : 'No invitations match your search.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Invitee</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Sent</th>
                      <th className="px-4 py-3 text-left">Expires</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInvitations.map((inv) => (
                      <InvitationRow
                        key={inv.id}
                        invitation={inv}
                        onRevoke={() => handleRevoke(inv)}
                        onResend={() => handleResend(inv)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {importOpen && (
        <UsersBulkImportModal
          onClose={() => setImportOpen(false)}
          onImport={handleBulkImport}
        />
      )}
      {modal.mode === 'invite' && (
        <InviteModal
          onClose={() => setModal({ mode: 'closed' })}
          onInvite={handleInvite}
        />
      )}
      {modal.mode !== 'closed' && modal.mode !== 'invite' && (
        <UserModal
          state={modal}
          shifts={shifts}
          onClose={() => setModal({ mode: 'closed' })}
          onAdd={handleAdd}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}

function InvitationRow({
  invitation: inv,
  onRevoke,
  onResend,
}: {
  invitation: Invitation;
  onRevoke: () => void;
  onResend: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const link = getInviteLink(inv.token);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = inv.status === 'pending' && inv.expiresAt?.toDate && inv.expiresAt.toDate() < new Date();
  const displayStatus = isExpired ? 'expired' : inv.status;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-slate-900">{inv.fullName}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Mail className="w-3 h-3" /> {inv.email}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-700">{ROLE_LABEL[inv.role] || inv.role}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${INVITE_STATUS_COLOR[displayStatus]}`}>
          {displayStatus === 'pending' && <Clock className="w-3 h-3" />}
          {displayStatus === 'accepted' && <CheckCircle className="w-3 h-3" />}
          {displayStatus === 'expired' && <XCircle className="w-3 h-3" />}
          {displayStatus === 'revoked' && <XCircle className="w-3 h-3" />}
          {displayStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {inv.expiresAt?.toDate ? inv.expiresAt.toDate().toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {inv.status === 'pending' && !isExpired && (
            <>
              <button
                onClick={copyLink}
                title="Copy invite link"
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onRevoke}
                title="Revoke"
                className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          {(displayStatus === 'expired' || displayStatus === 'revoked') && (
            <button
              onClick={onResend}
              title="Resend invitation"
              className="p-1.5 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function InviteModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (values: InviteFormValues) => Promise<Invitation>;
}) {
  const [values, setValues] = useState<InviteFormValues>(emptyInviteForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentInvite, setSentInvite] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof InviteFormValues>(key: K, value: InviteFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (!values.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(values.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const inv = await onInvite(values);
      setSentInvite(inv);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!sentInvite) return;
    await navigator.clipboard.writeText(getInviteLink(sentInvite.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (sentInvite) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-lg w-full max-w-lg border border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Invitation Created!</h2>
            <p className="text-sm text-slate-600">
              An invitation has been created for <strong>{sentInvite.email}</strong> as{' '}
              <strong>{ROLE_LABEL[sentInvite.role]}</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Share the link below with the team member. The invitation expires in 7 days.
            </p>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
              <input
                type="text"
                readOnly
                value={getInviteLink(sentInvite.token)}
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 truncate"
              />
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[#1A56DB] text-white hover:bg-[#1E40AF] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setSentInvite(null);
                  setValues(emptyInviteForm);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Invite Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-[#1A56DB] text-white hover:bg-[#1E40AF]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invite Team Member</h2>
            <p className="text-xs text-slate-500 mt-0.5">Send an invitation via email with a role assignment</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <Field label="Email address" required>
            <input
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="teammate@company.com"
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </Field>

          <Field label="Full name" required>
            <input
              type="text"
              value={values.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </Field>

          <Field label="Assign role" required>
            <select
              value={values.role}
              onChange={(e) => set('role', e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Department">
              <input
                type="text"
                value={values.department}
                onChange={(e) => set('department', e.target.value)}
                placeholder="e.g. Maintenance"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Job title">
              <input
                type="text"
                value={values.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
                placeholder="e.g. Senior Technician"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <strong>How it works:</strong> A unique invite link will be generated. Share it with the member — they can sign up with email/password or Google to join your team with the assigned role.
          </div>

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
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UserModalProps {
  state: Exclude<ModalState, { mode: 'closed' } | { mode: 'invite' }>;
  shifts: Array<{ id: string; shiftName: string; department: string | null; status: string }>;
  onClose: () => void;
  onAdd: (values: UserFormValues) => Promise<void>;
  onEdit: (userId: string, values: UserFormValues) => Promise<void>;
}

function UserModal({ state, shifts, onClose, onAdd, onEdit }: UserModalProps) {
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
            <Field label="Designation">
              <input
                type="text"
                value={values.jobTitle}
                onChange={(e) => set('jobTitle', e.target.value)}
                disabled={isView}
                placeholder="e.g. Senior Technician"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Employee ID">
              <input
                type="text"
                value={values.employeeId}
                onChange={(e) => set('employeeId', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              />
            </Field>
            <Field label="Shift">
              <select
                value={values.shiftId}
                onChange={(e) => set('shiftId', e.target.value)}
                disabled={isView}
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              >
                <option value="">No shift assigned</option>
                {shifts
                  .filter((s) => s.status === 'active')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shiftName}
                      {s.department ? ` · ${s.department}` : ''}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

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
                {saving ? 'Saving...' : isAdd ? 'Add user' : 'Save changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function UserShiftChips({
  userDepartment,
  shifts,
}: {
  userDepartment: string | null;
  shifts: Array<{ id: string; shiftName: string; color: string; department: string | null; status: string }>;
}) {
  const matching = shifts.filter(
    (s) => s.status === 'active' && (!s.department || s.department === userDepartment),
  );
  if (matching.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {matching.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          title={s.department ? `${s.shiftName} • ${s.department}` : `${s.shiftName} • All`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.shiftName}
        </span>
      ))}
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
