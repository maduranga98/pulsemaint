import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useContractor } from '@/hooks/contractors/useContractor';
import {
  CONTRACTOR_SPECIALIZATION_TAGS,
  SPECIALIZATION_LABELS,
} from '@/lib/contractors/contractorTypes';
import type {
  ContractorSpecializationTag,
  TechnicianDesignation,
  TechnicianStatus,
} from '@/lib/contractors/contractorTypes';
import type { TechnicianCertificationDoc } from '@/lib/contractors/contractorTypes';

export function TechnicianForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contractorId, techId } = useParams();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { contractor } = useContractor(contractorId);

  const [fullName, setFullName] = useState('');
  const [nicOrPassport, setNicOrPassport] = useState('');
  const [designation, setDesignation] = useState<TechnicianDesignation>('technician');
  const [status, setStatus] = useState<TechnicianStatus>('active');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState<ContractorSpecializationTag[]>([]);
  const [certifications, setCertifications] = useState('');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [existingCertDocs, setExistingCertDocs] = useState<TechnicianCertificationDoc[]>([]);
  const [saving, setSaving] = useState(false);

  // Load existing technician when editing.
  useEffect(() => {
    if (!contractorId || !techId) return;
    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, 'contractors', contractorId, 'technicians', techId));
      if (cancelled || !snap.exists()) return;
      const data = snap.data() as Record<string, any>;
      setFullName(data.fullName ?? '');
      setNicOrPassport(data.nicOrPassport ?? '');
      setDesignation(data.designation ?? 'technician');
      setStatus(data.status ?? 'active');
      setPhone(data.phone ?? '');
      setEmail(data.email ?? '');
      setSpecialization(data.specialization ?? []);
      setCertifications((data.certifications ?? []).join(', '));
      setExistingCertDocs((data.certificationDocuments ?? []) as TechnicianCertificationDoc[]);
    })();
    return () => { cancelled = true; };
  }, [contractorId, techId]);

  function toggleSpecialization(tag: ContractorSpecializationTag) {
    setSpecialization((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractorId) {
      toast.error(t('common.contractors.technicians.form.errors.missingContractor'));
      return;
    }
    if (!userProfile?.companyId) {
      toast.error(t('common.contractors.technicians.form.errors.mustBeLoggedIn'));
      return;
    }
    if (fullName.trim().length === 0 || nicOrPassport.trim().length === 0) {
      toast.error(t('common.contractors.technicians.form.errors.requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const certList = certifications
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      // Upload any newly attached certification files and keep the existing ones.
      const uploadedCertDocs: TechnicianCertificationDoc[] = await Promise.all(
        certFiles.map(async (file) => {
          const path = `contractors/${contractorId}/technicians/certifications/${Date.now()}_${file.name}`;
          const sref = storageRef(storage, path);
          await uploadBytes(sref, file);
          const url = await getDownloadURL(sref);
          return {
            id: nanoid(),
            name: file.name,
            url,
            storagePath: path,
            fileSize: file.size,
            uploadedAt: Timestamp.now(),
          };
        }),
      );
      const certificationDocuments = [...existingCertDocs, ...uploadedCertDocs];

      const payload: Record<string, unknown> = {
        companyId: userProfile.companyId,
        contractorId,
        contractorName: contractor?.companyName ?? '',
        fullName: fullName.trim(),
        nicOrPassport: nicOrPassport.trim(),
        designation,
        status,
        phone: phone.trim(),
        email: email.trim(),
        specialization,
        certifications: certList,
        certificationDocuments,
        updatedAt: serverTimestamp(),
      };

      if (techId) {
        await updateDoc(doc(db, 'contractors', contractorId, 'technicians', techId), payload);
        toast.success(t('common.contractors.technicians.form.toasts.updated'));
      } else {
        await addDoc(collection(db, 'contractors', contractorId, 'technicians'), {
          ...payload,
          jobsAtThisFactory: 0,
          lastVisitedAt: null,
          createdAt: serverTimestamp(),
        });
        toast.success(t('common.contractors.technicians.form.toasts.added'));
      }
      navigate(`/app/contractors/${contractorId}/technicians`);
    } catch (err) {
      console.error('Save technician failed', err);
      toast.error(err instanceof Error ? err.message : t('common.contractors.technicians.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder={t('common.contractors.technicians.form.fields.fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder={t('common.contractors.technicians.form.fields.nicOrPassport')} value={nicOrPassport} onChange={(e) => setNicOrPassport(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={designation} onChange={(e) => setDesignation(e.target.value as TechnicianDesignation)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="engineer">{t('common.contractors.technicians.designations.engineer')}</option>
          <option value="senior_technician">{t('common.contractors.technicians.designations.senior_technician')}</option>
          <option value="technician">{t('common.contractors.technicians.designations.technician')}</option>
          <option value="helper">{t('common.contractors.technicians.designations.helper')}</option>
          <option value="other">{t('common.contractors.technicians.designations.other')}</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as TechnicianStatus)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="active">{t('common.contractors.technicians.statuses.active')}</option>
          <option value="inactive">{t('common.contractors.technicians.statuses.inactive')}</option>
        </select>
        <input placeholder={t('common.contractors.technicians.form.fields.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder={t('common.contractors.technicians.form.fields.email')} value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">{t('common.contractors.technicians.form.fields.specialization')}</p>
        <div className="flex flex-wrap gap-2">
          {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => {
            const checked = specialization.includes(tag);
            return (
              <label key={tag} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${checked ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleSpecialization(tag)} className="mr-1" /> {SPECIALIZATION_LABELS[tag]}
              </label>
            );
          })}
        </div>
      </div>
      <input placeholder={t('common.contractors.technicians.form.fields.certifications')} value={certifications} onChange={(e) => setCertifications(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">{t('common.contractors.technicians.form.fields.certificationAttachments')}</p>
        {existingCertDocs.length > 0 && (
          <ul className="mb-2 space-y-1">
            {existingCertDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">{d.name}</a>
                <button type="button" onClick={() => setExistingCertDocs((prev) => prev.filter((x) => x.id !== d.id))} className="ml-2 text-slate-400 hover:text-red-500" aria-label={t('common.contractors.technicians.form.actions.removeAttachment')}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="file"
          multiple
          onChange={(e) => setCertFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />
        {certFiles.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {certFiles.map((f, i) => (
              <li key={i} className="truncate text-xs text-slate-500">{f.name}</li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? t('common.contractors.technicians.form.actions.saving') : t('common.contractors.technicians.form.actions.save')}
      </button>
    </form>
  );
}

export default TechnicianForm;
