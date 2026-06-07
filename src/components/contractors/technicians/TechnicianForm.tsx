import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import PhotoUploadCrop from './PhotoUploadCrop';

export function TechnicianForm() {
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>();
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
      setExistingPhotoUrl(data.photoUrl);
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
      toast.error('Missing contractor reference.');
      return;
    }
    if (!userProfile?.companyId) {
      toast.error('You must be logged in.');
      return;
    }
    if (fullName.trim().length === 0 || nicOrPassport.trim().length === 0) {
      toast.error('Full name and NIC/Passport are required.');
      return;
    }
    setSaving(true);
    try {
      let photoUrl = existingPhotoUrl ?? null;
      if (photoFile) {
        const path = `contractors/${contractorId}/technicians/${Date.now()}_${photoFile.name}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, photoFile);
        photoUrl = await getDownloadURL(sref);
      }

      const certList = certifications
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

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
        photoUrl,
        updatedAt: serverTimestamp(),
      };

      if (techId) {
        await updateDoc(doc(db, 'contractors', contractorId, 'technicians', techId), payload);
        toast.success('Technician updated');
      } else {
        await addDoc(collection(db, 'contractors', contractorId, 'technicians'), {
          ...payload,
          jobsAtThisFactory: 0,
          lastVisitedAt: null,
          createdAt: serverTimestamp(),
        });
        toast.success('Technician added');
      }
      navigate(`/app/contractors/${contractorId}/technicians`);
    } catch (err) {
      console.error('Save technician failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save technician');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <PhotoUploadCrop photoUrl={existingPhotoUrl} onFileSelect={setPhotoFile} />
      <div className="grid gap-4 sm:grid-cols-2">
        <input placeholder="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="NIC/Passport *" value={nicOrPassport} onChange={(e) => setNicOrPassport(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={designation} onChange={(e) => setDesignation(e.target.value as TechnicianDesignation)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="engineer">Engineer</option>
          <option value="senior_technician">Senior Technician</option>
          <option value="technician">Technician</option>
          <option value="helper">Helper</option>
          <option value="other">Other</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as TechnicianStatus)} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Specialization</p>
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
      <input placeholder="Certifications, comma separated" value={certifications} onChange={(e) => setCertifications(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
      <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Technician'}
      </button>
    </form>
  );
}

export default TechnicianForm;
