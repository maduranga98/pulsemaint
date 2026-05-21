import { Check } from 'lucide-react';
import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';

interface ContractorJobStatusStepperProps {
  status: ContractorJobStatus;
}

const STEPS: Array<{ label: string; value: ContractorJobStatus }> = [
  { label: 'Invited', value: 'invitation_sent' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'On Site', value: 'contractor_arrived' },
  { label: 'Working', value: 'work_in_progress' },
  { label: 'Checklist', value: 'checklist_complete' },
  { label: 'Signed Off', value: 'signed_off' },
  { label: 'Invoice', value: 'invoice_submitted' },
  { label: 'Done', value: 'payment_processed' },
];

export function ContractorJobStatusStepper({ status }: ContractorJobStatusStepperProps) {
  const current = STEPS.findIndex((step) => step.value === status);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-[720px] items-center">
        {STEPS.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <div key={step.value} className="flex flex-1 items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${complete ? 'border-emerald-600 bg-emerald-600 text-white' : active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`ml-2 text-xs font-medium ${active ? 'text-blue-700' : 'text-slate-500'}`}>{step.label}</span>
              {index < STEPS.length - 1 && <div className={`mx-3 h-px flex-1 ${complete ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContractorJobStatusStepper;
