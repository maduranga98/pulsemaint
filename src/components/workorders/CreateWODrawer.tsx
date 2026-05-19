import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createWOSchema, type CreateWOFormValues } from '../../schemas/workOrder';
import { WO_TYPES_ORDERED, WO_TYPE_CONFIG, WO_PRIORITY_CONFIG, getSlaDeadline } from '../../constants/woConfig';
import { WO_COPY } from '../../constants/copy';
import { useCreateWorkOrder } from '../../hooks/useCreateWorkOrder';
import { TeamAssignmentPanel } from './TeamAssignmentPanel';
import { ChecklistBuilder } from './ChecklistBuilder';
import { DocumentUploadZone } from './DocumentUploadZone';
import { PartsPreRequestPanel } from './PartsPreRequestPanel';
import type { WOType, ChecklistItem } from '../../types/workOrder';

interface CreateWODrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (woId: string) => void;
  linkedBreakdownId?: string;
  linkedBreakdownTicketNumber?: string;
}

const STEPS = [
  WO_COPY.step1Title,
  WO_COPY.step2Title,
  WO_COPY.step3Title,
  WO_COPY.step4Title,
  WO_COPY.step5Title,
  WO_COPY.step6Title,
];

type PendingFile = {
  file: File;
  fileType: import('../../types/workOrder').WODocument['fileType'];
  error?: string;
};

export function CreateWODrawer({
  open,
  onClose,
  onCreated,
  linkedBreakdownId,
  linkedBreakdownTicketNumber,
}: CreateWODrawerProps) {
  const [step, setStep] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const { createWO, loading, uploadProgress } = useCreateWorkOrder();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<CreateWOFormValues>({
    resolver: zodResolver(createWOSchema) as any,
    defaultValues: {
      woType: 'CORRECTIVE',
      priority: 'medium',
      description: '',
      scheduledStart: null,
      estimatedDuration: 1,
      estimatedDurationUnit: 'hours',
      linkedBreakdownId: linkedBreakdownId ?? null,
      linkedBreakdownTicketNumber: linkedBreakdownTicketNumber ?? null,
      assignedTechnicianIds: [],
      assignedTechnicianNames: [],
      contractorCompanyId: null,
      contractorCompanyName: null,
      contractorContactPerson: null,
      contractorContactNumber: null,
      contractorTechnicianNames: [],
      isManualContractor: false,
      checklist: [],
      partsRequests: [],
    },
  });

  const woType = form.watch('woType');
  const priority = form.watch('priority');
  const isContractorWO = woType === 'CONTRACTOR';

  // Auto-suggest due date from priority
  useEffect(() => {
    const sla = getSlaDeadline(new Date(), priority, woType);
    form.setValue('dueDate', sla);
  }, [priority, woType, form]);

  function nextStep() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(values: CreateWOFormValues) {
    const woId = await createWO({
      ...values,
      dueDate: values.dueDate as Date,
      scheduledStart: values.scheduledStart ?? null,
      documents: pendingFiles.filter((f) => !f.error).map((f) => f.file),
    });
    if (woId) {
      onCreated?.(woId);
      onClose();
      form.reset();
      setStep(0);
      setPendingFiles([]);
    }
  }

  if (!open) return null;

  const progressMap: Record<string, number> = {};
  for (const up of uploadProgress) progressMap[up.fileName] = up.progress;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-lg text-gray-900">{WO_COPY.createTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i === step ? 'bg-blue-600' : i < step ? 'bg-blue-300' : 'bg-gray-200'
                  }`}
                  aria-label={label}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Step {step + 1} of {STEPS.length} — <span className="font-medium">{STEPS[step]}</span>
          </p>
        </div>

        {/* Step content */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form onSubmit={(form.handleSubmit as any)(handleSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── STEP 0: Basic Info ── */}
          {step === 0 && (
            <div className="space-y-5">
              {/* WO Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {WO_COPY.woTypeLabel} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WO_TYPES_ORDERED.map((type) => {
                    const cfg = WO_TYPE_CONFIG[type];
                    const isSelected = woType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => form.setValue('woType', type as WOType)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          isSelected
                            ? `border-[${cfg.color}] ${cfg.bgClass} ${cfg.textClass}`
                            : 'border-gray-100 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <span className="text-2xl">{cfg.icon}</span>
                        <span className="text-center leading-tight text-xs">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {WO_COPY.priorityLabel} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
                    const cfg = WO_PRIORITY_CONFIG[p];
                    const isSelected = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => form.setValue('priority', p)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                          isSelected
                            ? `${cfg.bgClass} ${cfg.textClass} border-current`
                            : 'border-gray-100 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {WO_COPY.descriptionLabel} <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...form.register('description')}
                  rows={4}
                  placeholder={WO_COPY.descriptionPlaceholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {form.formState.errors.description && (
                  <p className="mt-1 text-xs text-red-500">{form.formState.errors.description.message}</p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {WO_COPY.dueDateLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...form.register('dueDate', { valueAsDate: true })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">{WO_COPY.dueDateHint}</p>
              </div>

              {/* Linked Breakdown (only for BREAKDOWN type) */}
              {woType === 'BREAKDOWN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {WO_COPY.linkedBreakdownLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...form.register('linkedBreakdownTicketNumber')}
                    placeholder={WO_COPY.linkedBreakdownPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Machine Selection ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {WO_COPY.machineLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  {...form.register('machineId')}
                  placeholder={WO_COPY.machinePlaceholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Machine search integrates with Module 3 — Asset Registry.
                </p>
                {form.formState.errors.machineId && (
                  <p className="mt-1 text-xs text-red-500">{form.formState.errors.machineId.message}</p>
                )}
              </div>

              {/* Machine preview card (populated after selection) */}
              {form.watch('machineName') && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-gray-900">{form.watch('machineName')}</p>
                  <p className="text-sm text-gray-600">{form.watch('machineLocation')}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>Type: {form.watch('machineType')}</span>
                    <span>Dept: {form.watch('machineDepartment')}</span>
                    <span>Criticality: {form.watch('machineCriticality')}/5</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Team Assignment ── */}
          {step === 2 && (
            <TeamAssignmentPanel
              form={form}
              isContractorWO={isContractorWO}
              technicians={[]}
              contractors={[]}
            />
          )}

          {/* ── STEP 3: Checklist ── */}
          {step === 3 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">{WO_COPY.checklistLabel}</p>
              <ChecklistBuilder
                items={form.watch('checklist') as Omit<ChecklistItem, 'isCompleted' | 'completedBy' | 'completedByName' | 'completedAt'>[]}
                onChange={(items) => form.setValue('checklist', items)}
                technicianOptions={(form.watch('assignedTechnicianIds') ?? []).map((id, i) => ({
                  id,
                  name: form.watch('assignedTechnicianNames')?.[i] ?? id,
                }))}
              />
            </div>
          )}

          {/* ── STEP 4: Documents ── */}
          {step === 4 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">{WO_COPY.documentsLabel}</p>
              <DocumentUploadZone
                pendingFiles={pendingFiles}
                uploadedDocs={[]}
                onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
                onRemovePending={(i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                progress={progressMap}
              />
            </div>
          )}

          {/* ── STEP 5: Parts Pre-Request ── */}
          {step === 5 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">{WO_COPY.partsRequestLabel}</p>
              <PartsPreRequestPanel
                requests={form.watch('partsRequests') ?? []}
                onChange={(reqs) => form.setValue('partsRequests', reqs)}
                catalogItems={[]}
              />
            </div>
          )}
        </form>

        {/* Footer nav */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 0 ? onClose : prevStep}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={(form.handleSubmit as any)(handleSubmit)}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating…' : 'Create Work Order'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
