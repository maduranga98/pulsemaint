import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateWOPayload, WorkOrder } from '../../types/workOrder';
import { useCreateWorkOrder } from '../../hooks/useCreateWorkOrder';

interface Props {
  workOrder: WorkOrder;
  onClose: () => void;
  onCreated?: (extensionWoId: string) => void;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Extends an unfinished (or overdue) work order, before it is signed off, with
// a second work order on the same ticket that carries extra tasks and
// attachments. The extension is worked like any WO; when it is signed off it
// folds into this one, which then closes as a single "Extended WO".
export function ExtendWODialog({ workOrder: wo, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const d = (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
    t(`common.workOrders.extension.${key}`, { defaultValue, ...opts });
  const { createWO, loading } = useCreateWorkOrder();

  const parentDue = wo.dueDate?.toDate ? wo.dueDate.toDate() : new Date();
  const base = parentDue.getTime() > Date.now() ? parentDue : new Date();
  const [reason, setReason] = useState('');
  const [tasks, setTasks] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [dueDate, setDueDate] = useState(toDateInput(new Date(base.getTime() + 24 * 3600 * 1000)));
  const [hours, setHours] = useState('2');

  const cleanTasks = tasks.map((x) => x.trim()).filter(Boolean);

  async function submit() {
    if (!reason.trim()) {
      toast.error(d('reasonRequired', 'Say why this work order needs to be extended.'));
      return;
    }
    if (cleanTasks.length === 0 && files.length === 0) {
      toast.error(d('contentRequired', 'Add at least one extra task or attachment.'));
      return;
    }
    const due = new Date(`${dueDate}T23:59:00`);
    if (Number.isNaN(due.getTime())) {
      toast.error(d('dueRequired', 'Choose a due date for the extension.'));
      return;
    }
    const est = Number(hours);
    const payload: CreateWOPayload = {
      woType: wo.woType,
      priority: wo.priority,
      description: `${d('descriptionPrefix', 'Extension of {{wo}}', { wo: wo.woNumber })}: ${reason.trim()}`,
      specialToolsRequired: wo.specialToolsRequired ?? '',
      dueDate: due,
      scheduledStart: null,
      estimatedDuration: Number.isFinite(est) && est > 0 ? est : 1,
      estimatedDurationUnit: 'hours',
      // The ticket stays linked to the original WO only.
      linkedBreakdownId: null,
      linkedBreakdownTicketNumber: null,
      extensionOfWoId: wo.id,
      extensionOfWoNumber: wo.woNumber,
      extensionReason: reason.trim(),
      machineId: wo.machineId,
      machineName: wo.machineName,
      machineDepartment: wo.machineDepartment,
      machinePlantId: wo.machinePlantId ?? null,
      machineLocation: wo.machineLocation,
      machineType: wo.machineType,
      machineCriticality: wo.machineCriticality,
      supervisorInChargeId: wo.supervisorInChargeId,
      supervisorInChargeName: wo.supervisorInChargeName,
      assignedTechnicianIds: wo.assignedTechnicianIds ?? [],
      assignedTechnicianNames: wo.assignedTechnicianNames ?? [],
      contractorCompanyId: wo.contractorCompanyId ?? null,
      contractorCompanyName: wo.contractorCompanyName ?? null,
      contractorContactPerson: wo.contractorContactPerson ?? null,
      contractorContactNumber: wo.contractorContactNumber ?? null,
      contractorTechnicianNames: wo.contractorTechnicianNames ?? [],
      contractorTechnicianIds: wo.contractorTechnicianIds ?? [],
      isManualContractor: wo.isManualContractor ?? false,
      checklist: cleanTasks.map((stepDescription, i) => ({
        stepNumber: i + 1,
        stepDescription,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        assignedTechnicianIds: [],
        assignedTechnicianNames: [],
        estimatedMinutes: null,
        estimatedDurationUnit: 'minutes' as const,
        inputType: 'checkbox' as const,
        method: null,
        unit: null,
        acceptableMin: null,
        acceptableMax: null,
        actualValue: null,
        result: null,
        repairNote: null,
      })),
      documents: files,
      partsRequests: [],
    };
    const id = await createWO(payload);
    if (id) {
      toast.success(d('created', 'Extension work order created.'));
      onCreated?.(id);
      onClose();
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div>
        <p className="text-sm font-semibold text-blue-900">
          {d('title', 'Extend {{wo}}', { wo: wo.woNumber })}
        </p>
        <p className="text-xs text-blue-800/80">
          {d('hint', 'Creates an extension work order on the same ticket. When it is signed off it joins this work order, which then closes as one "Extended WO".')}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {d('reasonLabel', 'Why is it being extended? (required)')}
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {d('tasksLabel', 'Extra tasks')}
        </label>
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={task}
                onChange={(e) => setTasks((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={d('taskPlaceholder', 'Describe the task')}
                className="h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm"
              />
              {tasks.length > 1 && (
                <button
                  type="button"
                  aria-label={d('removeTask', 'Remove task')}
                  onClick={() => setTasks((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded p-1 text-gray-500 hover:bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTasks((prev) => [...prev, ''])}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> {d('addTask', 'Add task')}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {d('attachmentsLabel', 'Attachments')}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
          <Paperclip className="h-3.5 w-3.5" /> {d('addFiles', 'Add files')}
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setFiles((prev) => [...prev, ...picked]);
              e.target.value = '';
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs text-gray-700">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={d('removeFile', 'Remove file')}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {d('dueLabel', 'New due date')}
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {d('hoursLabel', 'Estimated hours')}
          </label>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-gray-600">
          {d('cancel', 'Cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? d('creating', 'Creating…') : d('create', 'Create extension WO')}
        </button>
      </div>
    </div>
  );
}
