import { useState, type FormEvent } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useContractor } from '@/hooks/contractors/useContractor';
import type { Contractor } from '@/lib/contractors/contractorTypes';
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
  const { contractorId } = useParams<{ contractorId: string }>();
  const { contractor, loading: loadingContractor } = useContractor(mode === 'edit' ? contractorId : undefined);

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

  async function uploadDocuments(savedId: string) {
    if (!companyId || pendingFiles.length === 0) return;
    for (const file of pendingFiles) {
      const path = `contractors/${savedId}/documents/${Date.now()}_${file.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await addDoc(collection(db, 'contractors', savedId, 'documents'), {
        companyId,
        contractorId: savedId,
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

      updatedAt: serverTimestamp(),
      updatedBy: userProfile?.id ?? null,
    };

    if (!payload.companyName || !payload.registrationNumber || !payload.primaryContactName) {
      setError('Please fill in all required fields (Company Name, Registration Number, Primary Contact).');
      return null;
    }

    if (mode === 'edit' && contractorId) {
      await updateDoc(doc(db, 'contractors', contractorId), payload);
      return contractorId;
    }

    const createPayload: Record<string, unknown> = {
      ...payload,
      companyId,
      status: 'active',
      avgRating: 0,
      totalJobsCompleted: 0,
      blocksAssignment: false,
      createdAt: serverTimestamp(),
      createdBy: userProfile?.id ?? null,
    };
    const docRef = await addDoc(collection(db, 'contractors'), createPayload);
    return docRef.id;
  }

  async function handleSave(e: FormEvent<HTMLFormElement>, openDocsAfter: boolean) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const savedId = await saveContractor(e.currentTarget);
      if (!savedId) return;
      if (pendingFiles.length > 0) {
        await uploadDocuments(savedId);
      }
      if (openDocsAfter) {
        navigate(`/app/contractors/${savedId}/documents`);
      } else {
        navigate(`/app/contractors/${savedId}`);
      }
    } catch (err) {
      console.error('Save contractor failed', err);
      setError(err instanceof Error ? err.message : 'Failed to save contractor.');
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'edit' && loadingContractor) {
    return <div className="p-6 text-slate-500">Loading contractor…</div>;
  }
  if (mode === 'edit' && !contractor) {
    return <div className="p-6 text-slate-500">Contractor not found.</div>;
  }

  const initial: Partial<Contractor> | undefined = contractor ?? undefined;

  return (
    <form
      key={contractor?.id ?? 'new'}
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
          <div className="space-y-8">
            <div id={SECTION_ANCHORS[0]}>
              <ContractorFormSection1 initial={initial} />
            </div>
            <div id={SECTION_ANCHORS[1]}>
              <ContractorFormSection2 initial={initial} />
            </div>
            <div id={SECTION_ANCHORS[2]}>
              <ContractorFormSection3 initial={initial} />
            </div>
            <div id={SECTION_ANCHORS[3]}>
              <ContractorFormSection4 initial={initial} />
            </div>
            <div id={SECTION_ANCHORS[4]}>
              <ContractorFormSection5
                files={pendingFiles}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
              />
            </div>
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
              const fakeEvent = {
                preventDefault: () => {},
                currentTarget: formEl,
              } as unknown as FormEvent<HTMLFormElement>;
              void handleSave(fakeEvent, true);
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
