import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContractorFormSection1 from './ContractorFormSection1';
import ContractorFormSection2 from './ContractorFormSection2';
import ContractorFormSection3 from './ContractorFormSection3';
import ContractorFormSection4 from './ContractorFormSection4';
import ContractorFormSection5 from './ContractorFormSection5';
import ContractorFormStepper from './ContractorFormStepper';

interface ContractorFormLayoutProps {
  mode: 'new' | 'edit';
}

const SECTIONS = [
  <ContractorFormSection1 key="company" />,
  <ContractorFormSection2 key="contacts" />,
  <ContractorFormSection3 key="specializations" />,
  <ContractorFormSection4 key="financial" />,
  <ContractorFormSection5 key="documents" />,
];

export function ContractorFormLayout({ mode }: ContractorFormLayoutProps) {
  const [step, setStep] = useState(0);

  return (
    <form className="space-y-5">
      <ContractorFormStepper step={step} onStepChange={setStep} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-lg border border-slate-200 bg-white p-3 lg:block">
          {['Company', 'Contacts', 'Specializations', 'Financial', 'Documents'].map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index)} className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${step === index ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </aside>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="lg:hidden">{SECTIONS[step]}</div>
          <div className="hidden space-y-8 lg:block">{SECTIONS}</div>
        </div>
      </div>
      <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-3 sm:flex-row sm:justify-end">
        <Link to="/app/contractors" className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700">Cancel</Link>
        {mode === 'new' && <button type="button" className="rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700">Save & Add Documents</button>}
        <button type="button" className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{mode === 'new' ? 'Save Contractor' : 'Update Contractor'}</button>
      </footer>
    </form>
  );
}

export default ContractorFormLayout;
