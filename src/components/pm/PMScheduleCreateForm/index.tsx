import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import type { PMSchedule } from '../../../types/pm.types';
import { createPMSchema } from '../../../schemas/pm';
import type { CreatePMFormValues } from '../../../schemas/pm';
import type { CreatePMPayload, UpdatePMPayload } from '../../../types/pm.types';
import { usePMSchedules } from '../../../hooks/pm/usePMSchedules';
import { useAuthStore } from '../../../store/authStore';
import { useMachines } from '../../../hooks/useMachines';
import { useToast } from '../../../hooks/useToast';
import { MachineFormStepper } from '../../machines/MachineFormStepper';
import { Step1BasicInfo } from './Step1BasicInfo';
import { Step2MachineSelect } from './Step2MachineSelect';
import { Step3TriggerConfig } from './Step3TriggerConfig';
import { Step4TeamAssign } from './Step4TeamAssign';
import { Step5Checklist } from './Step5Checklist';
import { Step6Parts } from './Step6Parts';
import { Step7Documents } from './Step7Documents';
import { Step8AlertSettings } from './Step8AlertSettings';

const STEPS = [
  { id: 'basic', label: 'Basic Info', description: 'Name, type, priority' },
  { id: 'machine', label: 'Machine', description: 'Select target machine' },
  { id: 'trigger', label: 'Trigger', description: 'Calendar or usage-based' },
  { id: 'team', label: 'Team', description: 'Assign technicians' },
  { id: 'checklist', label: 'Checklist', description: 'PM task steps' },
  { id: 'parts', label: 'Parts', description: 'Pre-allocate parts' },
  { id: 'documents', label: 'Documents', description: 'Attach references' },
  { id: 'alerts', label: 'Alerts', description: 'Notification settings' },
];

interface PMScheduleCreateFormProps {
  editSchedule?: PMSchedule;
  isDesktop?: boolean;
}

export default function PMScheduleCreateForm({ editSchedule, isDesktop = false }: PMScheduleCreateFormProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const { createSchedule, updateSchedule } = usePMSchedules({ companyId: company?.id || '' });
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  const { machines } = useMachines({ siteId: company?.id || '' });

  const methods = useForm<CreatePMFormValues>({
    resolver: zodResolver(createPMSchema) as any,
    defaultValues: editSchedule
      ? {
          name: editSchedule.name,
          pmType: editSchedule.pmType,
          priority: editSchedule.priority,
          description: editSchedule.description,
          machineId: editSchedule.machineId,
          machineName: editSchedule.machineName,
          machineCriticality: editSchedule.machineCriticality,
          department: editSchedule.department,
          location: editSchedule.location,
          triggerType: editSchedule.triggerType,
          firstDueDate: editSchedule.firstDueDate instanceof Date
            ? editSchedule.firstDueDate
            : 'toDate' in editSchedule.firstDueDate
            ? editSchedule.firstDueDate.toDate()
            : new Date(editSchedule.firstDueDate as unknown as string),
          recurrenceType: editSchedule.recurrenceType,
          customIntervalDays: editSchedule.customIntervalDays,
          endDate: editSchedule.endDate
            ? editSchedule.endDate instanceof Date
              ? editSchedule.endDate
              : 'toDate' in editSchedule.endDate
              ? editSchedule.endDate.toDate()
              : new Date(editSchedule.endDate as unknown as string)
            : null,
          noEndDate: editSchedule.noEndDate,
          seasonalOverride: editSchedule.seasonalOverride,
          peakSeasonStart: editSchedule.peakSeasonStart
            ? editSchedule.peakSeasonStart instanceof Date
              ? editSchedule.peakSeasonStart
              : 'toDate' in editSchedule.peakSeasonStart
              ? editSchedule.peakSeasonStart.toDate()
              : new Date(editSchedule.peakSeasonStart as unknown as string)
            : null,
          peakSeasonEnd: editSchedule.peakSeasonEnd
            ? editSchedule.peakSeasonEnd instanceof Date
              ? editSchedule.peakSeasonEnd
              : 'toDate' in editSchedule.peakSeasonEnd
              ? editSchedule.peakSeasonEnd.toDate()
              : new Date(editSchedule.peakSeasonEnd as unknown as string)
            : null,
          peakSeasonInterval: editSchedule.peakSeasonInterval,
          triggerAfterValue: editSchedule.triggerAfterValue,
          triggerUnit: editSchedule.triggerUnit,
          currentMeterValue: editSchedule.currentMeterValue,
          lastMeterResetDate: editSchedule.lastMeterResetDate
            ? editSchedule.lastMeterResetDate instanceof Date
              ? editSchedule.lastMeterResetDate
              : 'toDate' in editSchedule.lastMeterResetDate
              ? editSchedule.lastMeterResetDate.toDate()
              : new Date(editSchedule.lastMeterResetDate as unknown as string)
            : null,
          assignedTechnicianIds: editSchedule.assignedTechnicianIds ?? [],
          assignedTechnicianNames: editSchedule.assignedTechnicianNames ?? [],
          estimatedDuration: editSchedule.estimatedDuration,
          estimatedDurationUnit: editSchedule.estimatedDurationUnit,
          skillsRequired: editSchedule.skillsRequired ?? [],
          checklistItems: (editSchedule.checklistItems ?? []).map((i) => ({
            step: i.step,
            description: i.description,
            estimatedMinutes: i.estimatedMinutes,
            photoRequired: i.photoRequired,
          })),
          checklistTemplateId: editSchedule.checklistTemplateId,
          preallocatedParts: editSchedule.preallocatedParts ?? [],
          leadTimeDays: editSchedule.leadTimeDays,
          overdueEscalationHours: editSchedule.overdueEscalationHours,
          autoCloseAfterDays: editSchedule.autoCloseAfterDays,
        }
      : {
          name: '',
          pmType: 'inspection',
          priority: 'medium',
          description: '',
          machineId: '',
          machineName: '',
          machineCriticality: 1,
          department: '',
          location: '',
          triggerType: 'calendar',
          firstDueDate: new Date(),
          recurrenceType: 'monthly',
          customIntervalDays: null,
          endDate: null,
          noEndDate: true,
          seasonalOverride: false,
          peakSeasonStart: null,
          peakSeasonEnd: null,
          peakSeasonInterval: null,
          triggerAfterValue: null,
          triggerUnit: null,
          currentMeterValue: null,
          lastMeterResetDate: null,
          assignedTechnicianIds: [],
          assignedTechnicianNames: [],
          estimatedDuration: 1,
          estimatedDurationUnit: 'hours',
          skillsRequired: [],
          checklistItems: [],
          checklistTemplateId: null,
          preallocatedParts: [],
          leadTimeDays: 1,
          overdueEscalationHours: 24,
          autoCloseAfterDays: 3,
        },
  });

  const {
    handleSubmit,
    trigger,
  } = methods;

  const onSubmit = async (data: any) => {
    if (!company?.id || !userProfile?.id) {
      toast.error('Missing company or user info');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editSchedule) {
        await updateSchedule({
          scheduleId: editSchedule.id,
          companyId: company.id,
          ...data,
        } as UpdatePMPayload);
        toast.success('PM schedule updated');
        navigate(`/app/pm-schedules/${editSchedule.id}`);
      } else {
        const id = await createSchedule({ ...data, documents: documentFiles } as CreatePMPayload, userProfile.id);
        toast.success('PM schedule created');
        navigate(`/app/pm-schedules/${id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
    const fieldsToValidate: Record<number, (keyof CreatePMFormValues)[]> = {
      0: ['name', 'pmType', 'priority'],
      1: ['machineId'],
      2: ['triggerType', 'firstDueDate', 'recurrenceType'],
      3: ['assignedTechnicianIds', 'estimatedDuration'],
      4: ['checklistItems'],
      5: [],
      6: [],
      7: ['leadTimeDays', 'overdueEscalationHours', 'autoCloseAfterDays'],
    };

    const valid = await trigger(fieldsToValidate[currentStep]);
    if (valid) setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const stepContent = (
    <div className="space-y-6">
      {currentStep === 0 && <Step1BasicInfo />}
      {currentStep === 1 && <Step2MachineSelect machines={machines} />}
      {currentStep === 2 && <Step3TriggerConfig />}
      {currentStep === 3 && <Step4TeamAssign />}
      {currentStep === 4 && <Step5Checklist />}
      {currentStep === 5 && <Step6Parts />}
      {currentStep === 6 && <Step7Documents onFilesChange={setDocumentFiles} />}
      {currentStep === 7 && <Step8AlertSettings />}
    </div>
  );

  if (isDesktop) {
    return (
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex gap-6 h-[calc(100vh-8rem)]">
          <div className="w-64 flex-shrink-0">
            <MachineFormStepper
              steps={STEPS}
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              isDesktop
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {stepContent}

              <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={currentStep === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
                >
                  Back
                </button>
                {currentStep < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    );
  }

  // Mobile wizard
  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <MachineFormStepper
          steps={STEPS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
        />

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {stepContent}
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30"
          >
            Back
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editSchedule ? 'Update' : 'Create'}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
