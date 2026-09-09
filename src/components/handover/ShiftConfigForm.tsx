import { useState, useEffect, useMemo } from 'react';
import { Trans, useTranslation, type TFunction } from 'react-i18next';
import type { ShiftAssignBy, ShiftConfig, ShiftDay } from '@/types/handover.types';
import { useAuthStore } from '@/store/authStore';
import { useDepartments } from '@/hooks/useDepartments';
import { useCompanyUsers, type CompanyUserOption } from '@/hooks/useCompanyUsers';
import { resolveShiftAssignBy } from '@/utils/handover.utils';

interface ShiftConfigFormProps {
  onSave: (shift: Omit<ShiftConfig, 'id' | 'companyId'> & { id?: string }) => Promise<void>;
  initial?: ShiftConfig;
}

const DAYS: ShiftDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SCHEDULABLE_ROLES: Array<{ value: string; labelKey: string }> = [
  { value: 'supervisor', labelKey: 'common.shiftHandovers.configForm.roles.supervisor' },
  { value: 'technician', labelKey: 'common.shiftHandovers.configForm.roles.technician' },
  { value: 'floor_operator', labelKey: 'common.shiftHandovers.configForm.roles.floorOperator' },
  { value: 'store_keeper', labelKey: 'common.shiftHandovers.configForm.roles.storeKeeper' },
  { value: 'trainee', labelKey: 'common.shiftHandovers.configForm.roles.trainee' },
  { value: 'plant_manager', labelKey: 'common.shiftHandovers.configForm.roles.plantManager' },
  { value: 'hr_officer', labelKey: 'common.shiftHandovers.configForm.roles.hrOfficer' },
  { value: 'safety_officer', labelKey: 'common.shiftHandovers.configForm.roles.safetyOfficer' },
];

const ASSIGN_BY_OPTIONS: Array<{ value: ShiftAssignBy; labelKey: string; hintKey: string }> = [
  { value: 'department', labelKey: 'common.shiftHandovers.configForm.assignBy.department.label', hintKey: 'common.shiftHandovers.configForm.assignBy.department.hint' },
  { value: 'role', labelKey: 'common.shiftHandovers.configForm.assignBy.role.label', hintKey: 'common.shiftHandovers.configForm.assignBy.role.hint' },
  { value: 'employee', labelKey: 'common.shiftHandovers.configForm.assignBy.employee.label', hintKey: 'common.shiftHandovers.configForm.assignBy.employee.hint' },
];

const ROLE_LABEL_KEYS: Record<string, string> = SCHEDULABLE_ROLES.reduce<Record<string, string>>(
  (acc, role) => ({ ...acc, [role.value]: role.labelKey }),
  { admin: 'common.shiftHandovers.configForm.roles.admin' },
);

function roleLabelFor(t: TFunction, role: string): string {
  const key = ROLE_LABEL_KEYS[role];
  return key ? t(key) : role.replace(/_/g, ' ');
}

export function ShiftConfigForm({ onSave, initial }: ShiftConfigFormProps) {
  const { t } = useTranslation();
  const [shiftName, setShiftName] = useState(initial?.shiftName ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '06:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '14:00');
  const [color, setColor] = useState(initial?.color ?? '#00C2FF');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'active');
  const [activeDays, setActiveDays] = useState<ShiftDay[]>(initial?.activeDays ?? DAYS);
  const [roles, setRoles] = useState<string[]>(initial?.roles ?? []);
  const [assignBy, setAssignBy] = useState<ShiftAssignBy>(
    initial ? resolveShiftAssignBy(initial) : 'department',
  );
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
    setRoles(initial?.roles ?? []);
    setAssignBy(initial ? resolveShiftAssignBy(initial) : 'department');
    setMemberIds(initial?.memberIds ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { users, loading: usersLoading } = useCompanyUsers(companyId);
  const selectedMembers = useMemo(
    () => users.filter((user) => memberIds.includes(user.id)),
    [users, memberIds],
  );

  async function save() {
    setError(null);
    setSuccess(false);
    if (!shiftName.trim()) {
      setError(t('common.shiftHandovers.configForm.errors.shiftNameRequired'));
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError(t('common.shiftHandovers.configForm.errors.invalidTimes'));
      return;
    }
    // Only the dimension the shift is assigned by has to be filled in.
    if (assignBy === 'department' && !department.trim()) {
      setError(t('common.shiftHandovers.configForm.errors.departmentRequired'));
      return;
    }
    if (assignBy === 'role' && roles.length === 0) {
      setError(t('common.shiftHandovers.configForm.errors.roleRequired'));
      return;
    }
    if (assignBy === 'employee' && memberIds.length === 0) {
      setError(t('common.shiftHandovers.configForm.errors.employeeRequired'));
      return;
    }
    if (activeDays.length === 0) {
      setError(t('common.shiftHandovers.configForm.errors.activeDayRequired'));
      return;
    }
    setSaving(true);
    try {
      // Whichever category was picked is the only targeting written — the
      // other two are cleared so a plan never covers people the category
      // didn't select (a role plan quietly pulling in a whole department, say).
      // Names are stored alongside the ids so the shift cards and handover
      // records can show them without a second lookup.
      await onSave({
        id: initial?.id,
        shiftName: shiftName.trim(),
        startTime,
        endTime,
        color,
        activeDays,
        department: assignBy === 'department' ? department.trim() || null : null,
        status,
        memberIds: assignBy === 'employee' ? memberIds : [],
        memberNames: assignBy === 'employee' ? selectedMembers.map((user) => user.fullName || user.id) : [],
        roles: assignBy === 'role' ? roles : [],
        assignBy,
      });
      setSuccess(true);
      if (!initial) {
        setShiftName('');
        setDepartment('');
        setRoles([]);
        setMemberIds([]);
      }
    } catch (err) {
      console.error('Failed to save shift', err);
      setError(err instanceof Error ? err.message : t('common.shiftHandovers.configForm.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {t('common.shiftHandovers.configForm.shiftName')}
          <input value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder={t('common.shiftHandovers.configForm.shiftNamePlaceholder')} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {t('common.shiftHandovers.configForm.from')}
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {t('common.shiftHandovers.configForm.to')}
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {t('common.shiftHandovers.configForm.colour')}
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="min-h-12 rounded-md border border-slate-200 p-1" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {t('common.shiftHandovers.configForm.status')}
          <select value={status} onChange={(event) => setStatus(event.target.value as ShiftConfig['status'])} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
            <option value="active">{t('common.shiftHandovers.configForm.active')}</option>
            <option value="inactive">{t('common.shiftHandovers.configForm.inactive')}</option>
          </select>
        </label>
      </div>

      {/* Who works this shift: pick the category first, then the targets for
          that category. Only the picked category's selection is saved. */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {t('common.shiftHandovers.configForm.assignShiftBy')}
            <select
              value={assignBy}
              onChange={(event) => setAssignBy(event.target.value as ShiftAssignBy)}
              className="min-h-12 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {ASSIGN_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
          </label>

          {assignBy === 'department' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              {t('common.shiftHandovers.configForm.department')}
              <DepartmentPicker value={department} onChange={setDepartment} />
            </label>
          )}
        </div>

        <p className="text-xs text-slate-500">
          {t(ASSIGN_BY_OPTIONS.find((option) => option.value === assignBy)?.hintKey ?? '')}
        </p>

        {assignBy === 'role' && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-600">{t('common.shiftHandovers.configForm.rolesOnThisShift')}</legend>
            <div className="flex flex-wrap gap-2">
              {SCHEDULABLE_ROLES.map((role) => (
                <label key={role.value} className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={roles.includes(role.value)}
                    onChange={(event) => setRoles((current) => event.target.checked ? [...current, role.value] : current.filter((item) => item !== role.value))}
                  />
                  {t(role.labelKey)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {assignBy === 'employee' && (
          <EmployeePicker
            users={users}
            loading={usersLoading}
            selectedIds={memberIds}
            onToggle={(userId) =>
              setMemberIds((current) =>
                current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
              )
            }
            onClear={() => setMemberIds([])}
          />
        )}
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
            {t(`common.shiftHandovers.configForm.days.${day}`)}
          </label>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        <Trans
          t={t}
          i18nKey="common.shiftHandovers.configForm.individualAssignmentHint"
          components={{ strong: <span className="font-semibold" /> }}
        />
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && !error && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t('common.shiftHandovers.configForm.shiftSaved')}</div>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? t('common.shiftHandovers.configForm.saving') : t('common.shiftHandovers.configForm.saveShift')}
      </button>
    </form>
  );
}

/**
 * Named-employee selection for a shift plan. Every person is shown with their
 * role, since two people can share a name and the role is what tells whoever
 * is building the roster which is which.
 */
function EmployeePicker({
  users,
  loading,
  selectedIds,
  onToggle,
  onClear,
}: {
  users: CompanyUserOption[];
  loading: boolean;
  selectedIds: string[];
  onToggle: (userId: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? users.filter(
        (user) =>
          user.fullName.toLowerCase().includes(term) ||
          roleLabelFor(t, user.role).toLowerCase().includes(term),
      )
    : users;

  return (
    <fieldset>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <legend className="text-xs font-medium text-slate-600">
          {selectedIds.length > 0
            ? t('common.shiftHandovers.configForm.employeesOnShiftWithCount', { count: selectedIds.length })
            : t('common.shiftHandovers.configForm.employeesOnShift')}
        </legend>
        {selectedIds.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
            {t('common.shiftHandovers.configForm.clearSelection')}
          </button>
        )}
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('common.shiftHandovers.configForm.searchByNameOrRole')}
        className="mb-2 min-h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
      />
      {loading ? (
        <p className="text-xs text-slate-500">{t('common.shiftHandovers.configForm.loadingEmployees')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500">
          {users.length === 0 ? t('common.shiftHandovers.configForm.noEmployeesYet') : t('common.shiftHandovers.configForm.noEmployeesMatch')}
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {filtered.map((user) => (
            <label key={user.id} className="flex min-h-12 cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id)}
                onChange={() => onToggle(user.id)}
              />
              <span className="font-medium text-slate-800">{user.fullName || user.id}</span>
              <span className="text-xs text-slate-500">({roleLabelFor(t, user.role)})</span>
              {user.department && <span className="ml-auto text-xs text-slate-400">{user.department}</span>}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function DepartmentPicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const { t } = useTranslation();
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
          placeholder={t('common.shiftHandovers.configForm.newDepartmentPlaceholder')}
          className="flex-1 bg-transparent px-1 text-sm outline-none"
        />
        <button type="button" onClick={() => void commitAdd()} className="rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
          {t('common.shiftHandovers.configForm.add')}
        </button>
        <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="text-xs text-slate-500">
          {t('common.shiftHandovers.configForm.cancel')}
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
      className="min-h-12 rounded-md border border-slate-200 bg-white px-3 text-sm"
    >
      <option value="">{t('common.shiftHandovers.configForm.selectDepartment')}</option>
      {departments.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
      <option value="__add__">{t('common.shiftHandovers.configForm.addNewDepartment')}</option>
    </select>
  );
}

export default ShiftConfigForm;
