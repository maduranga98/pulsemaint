import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { X, Loader2, HardHat, Copy, Check, Mail, MailX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';
import { useContractors } from '@/hooks/contractors/useContractors';
import { useContractorTechnicians } from '@/hooks/contractors/useContractorTechnicians';
import { createModuleAssignment } from '@/lib/training/createModuleAssignment';
import { combineDueDateTime } from '@/lib/training/dueDateTime';
import { resolveAppBaseUrl } from '@/lib/machineQr';
import {
  MAX_SAFETY_TRAINING_ATTEMPTS,
  buildSafetyTrainingLink,
  type ContractorSafetyTrainingInvite,
} from '@/lib/safety/contractorSafety';
import { assignContractorSafetyTraining, type EmailResult } from '@/services/contractorSafetyTraining.service';
import type { Contractor, ContractorTechnician } from '@/lib/contractors/contractorTypes';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import type { UserProfile, UserRole } from '@/types/auth';

type AssignTab = 'contractors' | Exclude<UserRole, 'admin' | 'plant_manager'>;

const TABS: AssignTab[] = [
  'contractors',
  'technician',
  'supervisor',
  'floor_operator',
  'trainee',
  'hr_officer',
  'safety_officer',
  'store_keeper',
];

function roleLabel(role: UserRole, t: TFunction): string {
  return t(`common.trainingShared.assignForm.roleLabels.${role}`, { defaultValue: role.replace(/_/g, ' ') });
}

function tabLabel(tab: AssignTab, t: TFunction): string {
  return tab === 'contractors' ? t('common.safetyTrainings.assign.tabs.contractors') : roleLabel(tab, t);
}

interface SelectedMember {
  contractor: Contractor;
  technician: ContractorTechnician;
}

interface CreatedLink {
  inviteId: string;
  name: string;
  contractor: string;
  email: EmailResult['status'];
}

interface Props {
  module: TrainingModule;
  /** Existing contractor invites, so a team member isn't assigned the same training twice. */
  existingInvites: ContractorSafetyTrainingInvite[];
  onClose: () => void;
  onAssigned: () => void;
}

/**
 * Assign a Safety Training. People are picked by role tab:
 *  - Company roles (technician, supervisor, ...) complete the training inside
 *    FirmiCore exactly as before — an in-app assignment, no email.
 *  - Contractors: pick a contractor, then its team members. Team members have
 *    no login, so each gets a link to a public form that closes at the due
 *    date/time (3 submissions at most).
 */
export default function SafetyTrainingAssignDialog({ module, existingInvites, onClose, onAssigned }: Props) {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { plantId: scopePlantId } = useDepartmentScope();

  const [tab, setTab] = useState<AssignTab>('contractors');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserProfile>>(new Map());

  const { contractors, loading: contractorsLoading } = useContractors();
  const [contractorId, setContractorId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Map<string, SelectedMember>>(new Map());

  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    users: number;
    members: number;
    skipped: number;
    links: CreatedLink[];
  } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    // Everyone except deactivated accounts — invited-but-not-yet-accepted
    // people (`pending`) can be assigned too.
    const unsub = onSnapshot(
      collection(db, `companies/${companyId}/users`),
      (snap) => {
        setAllUsers(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as UserProfile)
            .filter((u) => u.status !== 'inactive')
            // Only people registered under the caller's plant (admin: the selected plant tab).
            .filter((u) => !scopePlantId || u.plantId === scopePlantId),
        );
        setUsersLoading(false);
      },
      () => setUsersLoading(false),
    );
    return () => unsub();
  }, [companyId, scopePlantId]);

  const activeContractors = useMemo(
    () =>
      contractors
        .filter((c) => c.status === 'active')
        .filter((c) => !scopePlantId || !c.plantId || c.plantId === scopePlantId)
        .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [contractors, scopePlantId],
  );
  const contractor = activeContractors.find((c) => c.id === contractorId) ?? null;
  const { technicians, loading: techniciansLoading } = useContractorTechnicians(contractorId || undefined);
  const team = useMemo(() => technicians.filter((tech) => tech.status === 'active'), [technicians]);

  const roleUsers = useMemo(() => {
    if (tab === 'contractors') return [];
    const term = search.trim().toLowerCase();
    return allUsers
      .filter((u) => u.role === tab)
      .filter((u) => !term || u.fullName.toLowerCase().includes(term))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [allUsers, tab, search]);

  const selectedCountByTab = useMemo(() => {
    const counts = new Map<AssignTab, number>();
    for (const u of selectedUsers.values()) {
      counts.set(u.role as AssignTab, (counts.get(u.role as AssignTab) ?? 0) + 1);
    }
    counts.set('contractors', selectedMembers.size);
    return counts;
  }, [selectedUsers, selectedMembers]);

  function toggleUser(u: UserProfile) {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(u.id)) next.delete(u.id);
      else next.set(u.id, u);
      return next;
    });
  }

  function toggleMember(c: Contractor, tech: ContractorTechnician) {
    setSelectedMembers((prev) => {
      const next = new Map(prev);
      if (next.has(tech.id)) next.delete(tech.id);
      else next.set(tech.id, { contractor: c, technician: tech });
      return next;
    });
  }

  const allTeamSelected = team.length > 0 && team.every((tech) => selectedMembers.has(tech.id));
  function toggleWholeTeam() {
    if (!contractor) return;
    setSelectedMembers((prev) => {
      const next = new Map(prev);
      if (allTeamSelected) team.forEach((tech) => next.delete(tech.id));
      else team.forEach((tech) => next.set(tech.id, { contractor, technician: tech }));
      return next;
    });
  }

  const allRoleUsersSelected = roleUsers.length > 0 && roleUsers.every((u) => selectedUsers.has(u.id));
  function toggleAllRoleUsers() {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (allRoleUsersSelected) roleUsers.forEach((u) => next.delete(u.id));
      else roleUsers.forEach((u) => next.set(u.id, u));
      return next;
    });
  }

  const dueAt = combineDueDateTime(dueDate, dueTime);
  const hasMembers = selectedMembers.size > 0;
  const totalSelected = selectedUsers.size + selectedMembers.size;

  async function handleSubmit() {
    if (!userProfile || totalSelected === 0) return;
    if (hasMembers) {
      if (!dueAt) {
        setError(t('common.safetyTrainings.assign.errors.dueRequired'));
        return;
      }
      if (dueAt.getTime() <= Date.now()) {
        setError(t('common.safetyTrainings.assign.errors.dueInPast'));
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      let users = 0;
      let skipped = 0;

      // Company users: in-app assignment, exactly as before (no email).
      for (const trainee of selectedUsers.values()) {
        const outcome = await createModuleAssignment({
          companyId,
          module,
          trainee,
          assigner: userProfile,
          dueDate,
          dueTime,
          notify: true,
          notification: {
            message: t('common.trainingShared.assignForm.notification.message', { title: module.title }),
            oversightMessage: t('common.trainingShared.assignForm.notification.oversightMessage', {
              title: module.title,
              name: trainee.fullName,
            }),
          },
        });
        if (outcome === 'assigned') users++;
        else skipped++;
      }

      // Contractor team members: one link each. Anyone who already has this
      // training awaiting them (or awaiting sign-off) is skipped — the
      // safety officer uses Reassign for those.
      const links: CreatedLink[] = [];
      let members = 0;
      if (dueAt) {
        const busy = new Set(
          existingInvites
            .filter((i) => i.moduleId === module.id && (i.status === 'assigned' || i.status === 'submitted'))
            .map((i) => i.technicianId),
        );
        const byContractor = new Map<string, { contractor: Contractor; techs: ContractorTechnician[] }>();
        for (const m of selectedMembers.values()) {
          if (busy.has(m.technician.id)) {
            skipped++;
            continue;
          }
          const entry = byContractor.get(m.contractor.id) ?? { contractor: m.contractor, techs: [] };
          entry.techs.push(m.technician);
          byContractor.set(m.contractor.id, entry);
        }
        for (const { contractor: c, techs } of byContractor.values()) {
          const created = await assignContractorSafetyTraining({
            companyId,
            plantId: c.plantId ?? scopePlantId ?? userProfile.plantId ?? null,
            module,
            contractor: c,
            technicians: techs,
            dueAt,
            assigner: { id: userProfile.id, name: userProfile.fullName ?? '' },
          });
          members += techs.length;
          created.inviteIds.forEach((inviteId, i) => {
            links.push({
              inviteId,
              name: techs[i].fullName,
              contractor: c.companyName,
              email: created.emails.find((e) => e.inviteId === inviteId)?.status ?? 'failed',
            });
          });
        }
      }
      setResult({ users, members, skipped, links });
    } catch (err) {
      console.error('Failed to assign safety training', err);
      setError(err instanceof Error ? err.message : t('common.trainingShared.assignForm.errors.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{t('common.safetyTrainings.assign.title')}</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{module.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label={t('common.trainingShared.assignForm.closeAria')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <AssignResult result={result} onDone={onAssigned} />
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map((key) => {
                const count = selectedCountByTab.get(key) ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => {
                      setTab(key);
                      setSearch('');
                    }}
                    className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                      tab === key
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {key === 'contractors' && <HardHat className="w-4 h-4" />}
                    {tabLabel(key, t)}
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[11px] font-semibold ${
                          tab === key ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {tab === 'contractors' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  {t('common.safetyTrainings.assign.contractorsHint')}
                </p>
                {contractorsLoading ? (
                  <Loading />
                ) : activeContractors.length === 0 ? (
                  <Empty>{t('common.safetyTrainings.assign.noContractors')}</Empty>
                ) : (
                  <select
                    value={contractorId}
                    onChange={(e) => setContractorId(e.target.value)}
                    aria-label={t('common.safetyTrainings.assign.selectContractor')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">{t('common.safetyTrainings.assign.selectContractor')}</option>
                    {activeContractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                )}

                {contractor &&
                  (techniciansLoading ? (
                    <Loading />
                  ) : team.length === 0 ? (
                    <Empty>{t('common.safetyTrainings.assign.noTeam')}</Empty>
                  ) : (
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">
                          {t('common.safetyTrainings.assign.teamMembers', { name: contractor.companyName })}
                        </span>
                        <button type="button" onClick={toggleWholeTeam} className="text-xs font-medium text-amber-700 hover:underline">
                          {allTeamSelected
                            ? t('common.safetyTrainings.assign.clearAll')
                            : t('common.safetyTrainings.assign.selectAll')}
                        </button>
                      </div>
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {team.map((tech) => (
                          <label key={tech.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={selectedMembers.has(tech.id)}
                              onChange={() => toggleMember(contractor, tech)}
                              className="w-4 h-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate text-sm text-slate-900">{tech.fullName}</span>
                              <span className="block truncate text-xs text-slate-400">
                                {[tech.nicOrPassport, tech.email || tech.phone].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            {!tech.email?.trim() && (
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {t('common.safetyTrainings.assign.noEmail')}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">{t('common.safetyTrainings.assign.usersHint')}</p>
                {usersLoading ? (
                  <Loading />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('common.trainingShared.assignForm.searchPlaceholder')}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                      {roleUsers.length > 0 && (
                        <button type="button" onClick={toggleAllRoleUsers} className="shrink-0 text-xs font-medium text-amber-700 hover:underline">
                          {allRoleUsersSelected
                            ? t('common.safetyTrainings.assign.clearAll')
                            : t('common.safetyTrainings.assign.selectAll')}
                        </button>
                      )}
                    </div>
                    {roleUsers.length === 0 ? (
                      <Empty>{t('common.safetyTrainings.assign.noUsers')}</Empty>
                    ) : (
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {roleUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(u.id)}
                              onChange={() => toggleUser(u)}
                              className="w-4 h-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="flex-1 min-w-0 truncate text-sm text-slate-900">{u.fullName}</span>
                            {u.department && <span className="shrink-0 text-xs text-slate-400">{u.department}</span>}
                            {u.status === 'pending' && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                {t('common.trainingShared.assignForm.invitePending')}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="text-sm text-slate-500">
              {t('common.safetyTrainings.assign.summary', { users: selectedUsers.size, members: selectedMembers.size })}
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {hasMembers
                  ? t('common.safetyTrainings.assign.dueRequiredLabel')
                  : t('common.trainingShared.assignForm.dueDate')}{' '}
                {!hasMembers && (
                  <span className="text-slate-400 font-normal">{t('common.trainingShared.assignForm.optional')}</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label={t('common.trainingShared.assignForm.dueDate')}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  disabled={!dueDate}
                  aria-label={t('common.trainingShared.assignForm.dueTime')}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {hasMembers
                  ? t('common.safetyTrainings.assign.dueHintContractor', { max: MAX_SAFETY_TRAINING_ATTEMPTS })
                  : t('common.trainingShared.assignForm.dueTimeHint')}
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t('common.trainingShared.assignForm.cancel')}
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || totalSelected === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasMembers
                  ? t('common.safetyTrainings.assign.assignAndSend')
                  : t('common.trainingShared.assignForm.assign')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">{children}</p>
  );
}

function AssignResult({
  result,
  onDone,
}: {
  result: { users: number; members: number; skipped: number; links: CreatedLink[] };
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = resolveAppBaseUrl();

  async function copy(inviteId: string) {
    try {
      await navigator.clipboard.writeText(buildSafetyTrainingLink(baseUrl, inviteId));
      setCopied(inviteId);
      setTimeout(() => setCopied((cur) => (cur === inviteId ? null : cur)), 2000);
    } catch {
      window.prompt(t('common.safetyTrainings.assign.result.copyPrompt'), buildSafetyTrainingLink(baseUrl, inviteId));
    }
  }

  const emailed = result.links.filter((l) => l.email === 'sent').length;

  return (
    <div className="p-6 space-y-4">
      <ul className="space-y-1 text-sm text-slate-700">
        {(result.users > 0 || result.members === 0) && (
          <li>{t('common.safetyTrainings.assign.result.users', { count: result.users })}</li>
        )}
        {result.members > 0 && (
          <li>
            {t('common.safetyTrainings.assign.result.members', { count: result.members })}{' '}
            {t('common.safetyTrainings.assign.result.emailed', { sent: emailed, total: result.members })}
          </li>
        )}
        {result.skipped > 0 && <li className="text-slate-500">{t('common.safetyTrainings.assign.result.skipped', { count: result.skipped })}</li>}
      </ul>

      {result.links.some((l) => l.email !== 'sent') && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {t('common.safetyTrainings.assign.result.shareManually')}
        </p>
      )}

      {result.links.length > 0 && (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {result.links.map((l) => (
            <div key={l.inviteId} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm text-slate-900">{l.name}</div>
                <div className="truncate text-xs text-slate-400">{l.contractor}</div>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 text-xs ${l.email === 'sent' ? 'text-emerald-600' : 'text-amber-600'}`}
              >
                {l.email === 'sent' ? <Mail className="w-3.5 h-3.5" /> : <MailX className="w-3.5 h-3.5" />}
                {t(`common.safetyTrainings.assign.result.email.${l.email}`)}
              </span>
              <button
                type="button"
                onClick={() => void copy(l.inviteId)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {copied === l.inviteId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === l.inviteId
                  ? t('common.safetyTrainings.assign.result.copied')
                  : t('common.safetyTrainings.assign.result.copyLink')}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onDone}
        className="w-full px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
      >
        {t('common.trainingShared.assignForm.result.done')}
      </button>
    </div>
  );
}
