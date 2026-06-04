import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import ContractorFormSection1 from './ContractorFormSection1';
import ContractorFormSection2 from './ContractorFormSection2';
import ContractorFormSection3 from './ContractorFormSection3';
import ContractorFormSection4 from './ContractorFormSection4';
import ContractorFormSection5 from './ContractorFormSection5';
import ContractorFormStepper from './ContractorFormStepper';

interface ContractorFormLayoutProps {
  mode: 'new' | 'edit';
}

const SECTION_ANCHORS = [
  'contractor-form-company',
  'contractor-form-contacts',
  'contractor-form-specializations',
  'contractor-form-financial',
  'contractor-form-documents',
];

function getAll(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter((v) => v.trim().length > 0);
}

function getStr(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? '' : String(v).trim();
}

export function ContractorFormLayout({ mode }: ContractorFormLayoutProps) {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;

  const [step, setStep] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToStep = (index: number) => {
    setStep(index);
    const id = SECTION_ANCHORS[index];
    if (id) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  function handleAddFiles(files: File[]) {
    setPendingFiles((prev) => [...prev, ...files]);
  }
  function handleRemoveFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadDocuments(contractorId: string) {
    if (!companyId || pendingFiles.length === 0) return;
    for (const file of pendingFiles) {
      const path = `contractors/${contractorId}/documents/${Date.now()}_${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await addDoc(collection(db, 'contractors', contractorId, 'documents'), {
        companyId,
        contractorId,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: url,
        storagePath: path,
        documentType: 'other',
        uploadedAt: serverTimestamp(),
        uploadedBy: userProfile?.id ?? null,
        uploadedByName: userProfile?.fullName ?? null,
      });
    }
  }

  async function saveContractor(formEl: HTMLFormElement): Promise<string | null> {
    if (!companyId) {
      setError('Missing company context. Please re-login.');
      return null;
    }

    const fd = new FormData(formEl);

    const completedProjectNames = fd.getAll('completedProjectName').map((v) => String(v));
    const completedProjectCosts = fd.getAll('completedProjectCost').map((v) => String(v));
    const previouslyCompletedProjects = completedProjectNames
      .map((name, i) => ({ name: name.trim(), cost: (completedProjectCosts[i] || '').trim() }))
      .filter((p) => p.name.length > 0 || p.cost.length > 0);

    const payload: Record<string, unknown> = {
      companyId,
      companyName: getStr(fd, 'companyName'),
      tradeName: getStr(fd, 'tradeName'),
      registrationNumber: getStr(fd, 'registrationNumber'),
      companyType: getStr(fd, 'companyType') || 'private_ltd',
      dateEstablished: getStr(fd, 'dateEstablished'),
      primaryAddress: getStr(fd, 'primaryAddress'),
      city: getStr(fd, 'city'),
      district: getStr(fd, 'district'),
      country: getStr(fd, 'country'),
      website: getStr(fd, 'website'),
      notes: getStr(fd, 'notes'),

      primaryContactName: getStr(fd, 'primaryContactName'),
      primaryContactDesig: getStr(fd, 'primaryContactDesig'),
      primaryPhone: getStr(fd, 'primaryPhone'),
      primaryEmail: getStr(fd, 'primaryEmail'),
      secondaryContactName: getStr(fd, 'secondaryContactName'),
      secondaryPhone: getStr(fd, 'secondaryPhone'),
      secondaryEmail: getStr(fd, 'secondaryEmail'),
      emergencyContact: getStr(fd, 'emergencyContact'),
      whatsappNumber: getStr(fd, 'whatsappNumber'),
      preferredContactMethod: 'phone',

      specializationTags: getAll(fd, 'specializationTags'),
      machineTypesServiced: getStr(fd, 'machineTypesServiced').split(',').map((s) => s.trim()).filter(Boolean),
      industriesServed: getStr(fd, 'industriesServed').split(',').map((s) => s.trim()).filter(Boolean),
      geographicCoverage: getStr(fd, 'geographicCoverage').split(',').map((s) => s.trim()).filter(Boolean),
      serviceHours: getStr(fd, 'serviceHours') || 'business_hours',
      emergencyResponseTime: getStr(fd, 'emergencyResponseTime'),
      teamSize: Number(getStr(fd, 'teamSize')) || 0,
      languagesSpoken: getStr(fd, 'languagesSpoken').split(',').map((s) => s.trim()).filter(Boolean),

      paymentMethods: getAll(fd, 'paymentMethods'),
      bankName: getStr(fd, 'bankName'),
      bankBranch: getStr(fd, 'bankBranch'),
      bankAccountName: getStr(fd, 'bankAccountName'),
      bankAccountNumber: getStr(fd, 'bankAccountNumber'),
      bankRoutingNumber: getStr(fd, 'bankRoutingNumber'),
      taxRegistrationNumber: getStr(fd, 'taxRegistrationNumber'),
      previouslyCompletedProjects,

      status: 'active',
      avgRating: 0,
      totalJobsCompleted: 0,
      blocksAssignment: false,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userProfile?.id ?? null,
    };

    if (!payload.companyName || !payload.registrationNumber || !payload.primaryContactName) {
      setError('Please fill in all required fields (Company Name, Registration Number, Primary Contact).');
      return null;
    }

    const docRef = await addDoc(collection(db, 'contractors'), payload);
    return docRef.id;
  }

  async function handleSave(e: FormEvent<HTMLFormElement>, openDocsAfter: boolean) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const contractorId = await saveContractor(e.currentTarget);
      if (!contractorId) return;
      if (pendingFiles.length > 0) {
        await uploadDocuments(contractorId);
      }
      if (openDocsAfter) {
        navigate(`/app/contractors/${contractorId}/documents`);
      } else {
        navigate(`/app/contractors/${contractorId}`);
      }
    } catch (err) {
      console.error('Save contractor failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save contractor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => handleSave(e, false)}
    >
      <ContractorFormStepper step={step} onStepChange={goToStep} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-lg border border-slate-200 bg-white p-3 lg:block lg:sticky lg:top-4 lg:self-start">
          {['Company', 'Contacts', 'Specializations', 'Financial', 'Documents'].map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(index)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                step === index ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </aside>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="lg:hidden">
            {step === 0 && <ContractorFormSection1 />}
            {step === 1 && <ContractorFormSection2 />}
            {step === 2 && <ContractorFormSection3 />}
            {step === 3 && <ContractorFormSection4 />}
            {step === 4 && (
              <ContractorFormSection5
                files={pendingFiles}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
              />
            )}
          </div>
          <div className="hidden space-y-8 lg:block">
            <ContractorFormSection1 />
            <ContractorFormSection2 />
            <ContractorFormSection3 />
            <ContractorFormSection4 />
            <ContractorFormSection5
              files={pendingFiles}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-3 sm:flex-row sm:justify-end">
        <Link to="/app/contractors" className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700">
          Cancel
        </Link>
        {mode === 'new' && (
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => {
              const formEl = (e.currentTarget as HTMLButtonElement).closest('form');
              if (!formEl) return;
              const submitEvent = new Event('submit', { cancelable: true, bubbles: true }) as unknown as FormEvent<HTMLFormElement>;
              // Mark intent to open documents page after save via a one-shot flag
              (formEl as unknown as { __openDocsAfter?: boolean }).__openDocsAfter = true;
              // Manually invoke handleSave because dispatching a submit doesn't pass the flag through default onSubmit
              const fakeEvent = {
                preventDefault: () => {},
                currentTarget: formEl,
              } as unknown as FormEvent<HTMLFormElement>;
              void handleSave(fakeEvent, true);
              void submitEvent;
            }}
            className="rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save & Add Documents'}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Saving…' : mode === 'new' ? 'Save Contractor' : 'Update Contractor'}
        </button>
      </footer>
    </form>
  );
}

export default ContractorFormLayout;
