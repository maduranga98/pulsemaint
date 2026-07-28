import { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { CompanyProfile } from '@/types/auth';

interface CompanyProfileEditModalProps {
  company: CompanyProfile;
  onClose: () => void;
}

const CURRENCY_OPTIONS: CompanyProfile['currency'][] = ['LKR', 'USD', 'AED', 'SAR'];

export function CompanyProfileEditModal({ company, onClose }: CompanyProfileEditModalProps) {
  const setCompany = useAuthStore((s) => s.setCompany);
  const toast = useToast();

  const [name, setName] = useState(company.name ?? '');
  const [tradeName, setTradeName] = useState(company.tradeName ?? '');
  const [industry, setIndustry] = useState(company.industry ?? '');
  const [country, setCountry] = useState(company.country ?? '');
  const [timezone, setTimezone] = useState(company.timezone ?? '');
  const [currency, setCurrency] = useState<CompanyProfile['currency']>(company.currency ?? 'LKR');
  const [description, setDescription] = useState(company.description ?? '');
  const [address, setAddress] = useState(company.address ?? '');
  const [phone, setPhone] = useState(company.phone ?? '');
  const [email, setEmail] = useState(company.email ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logoUrl ?? null);
  const [saving, setSaving] = useState(false);

  function handleLogoChange(file: File | null) {
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setSaving(true);
    try {
      let logoUrl = company.logoUrl ?? null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png';
        const path = `companies/${company.id}/branding/logo.${ext}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, logoFile);
        logoUrl = await getDownloadURL(fileRef);
      }

      const updates = {
        name: name.trim(),
        tradeName: tradeName.trim() || null,
        industry: industry.trim(),
        country: country.trim(),
        timezone: timezone.trim(),
        currency,
        description: description.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        logoUrl,
      };

      await updateDoc(doc(db, 'companies', company.id), updates);
      setCompany({ ...company, ...updates });
      toast.success('Company profile updated.');
      onClose();
    } catch (err) {
      console.error('Failed to update company profile', err);
      toast.error('Failed to update company profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Edit Company Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">No logo</span>
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              Upload Logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trade Name</label>
              <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as CompanyProfile['currency'])} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description <span className="text-slate-400 font-normal">(used on service letters and generated documents)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="A short description of the company…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
