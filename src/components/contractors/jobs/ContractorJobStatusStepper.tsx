import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';

interface ContractorJobStatusStepperProps {
  status: ContractorJobStatus;
}

const STEP_VALUES: ContractorJobStatus[] = [
  'invitation_sent',
  'acknowledged',
  'contractor_arrived',
  'work_in_progress',
  'checklist_complete',
  'signed_off',
  'invoice_submitted',
  'payment_processed',
];

export function ContractorJobStatusStepper({ status }: ContractorJobStatusStepperProps) {
  const { t } = useTranslation();
  const current = STEP_VALUES.findIndex((value) => value === status);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-[720px] items-center">
        {STEP_VALUES.map((value, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <div key={value} className="flex flex-1 items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${complete ? 'border-emerald-600 bg-emerald-600 text-white' : active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`ml-2 text-xs font-medium ${active ? 'text-blue-700' : 'text-slate-500'}`}>{t(`common.contractors.jobs.statusStepper.${value}`)}</span>
              {index < STEP_VALUES.length - 1 && <div className={`mx-3 h-px flex-1 ${complete ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContractorJobStatusStepper;
