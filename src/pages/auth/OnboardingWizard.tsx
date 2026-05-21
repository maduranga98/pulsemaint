import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, setDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { db, storage } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getDashboardRoute } from '../../lib/auth';

type StepError = { message: string } | null;

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<StepError>(null);

  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const setCompany = useAuthStore((s) => s.setCompany);

  // Step 1
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [currency, setCurrency] = useState<'LKR' | 'USD' | 'AED' | 'SAR'>('LKR');

  // Step 2
  const [machineName, setMachineName] = useState('');
  const [machineType, setMachineType] = useState('');
  const [machineLocation, setMachineLocation] = useState('');

  // Step 3
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'technician' | 'maintenance_supervisor' | 'plant_manager' | 'store_keeper' | 'hr_officer'>('technician');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');

  // Hydrate defaults from company once loaded
  useEffect(() => {
    if (!company) return;
    if (company.language) setLanguage(company.language);
    if (company.timezone) setTimezone(company.timezone);
    if (company.currency) setCurrency(company.currency);
    if (company.logoUrl && !logoPreview) setLogoPreview(company.logoUrl);
  }, [company]);

  // If onboarding already complete, bounce to dashboard
  useEffect(() => {
    if (company?.onboardingCompletedAt && userProfile?.role) {
      navigate(getDashboardRoute(userProfile.role), { replace: true });
    }
  }, [company, userProfile, navigate]);

  if (!userProfile || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return company.logoUrl;
    const path = `companies/${company.id}/branding/logo-${Date.now()}-${logoFile.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, logoFile);
    return getDownloadURL(ref);
  };

  const saveStep1 = async () => {
    const logoUrl = await uploadLogo();
    const companyRef = doc(db, 'companies', company.id);
    await updateDoc(companyRef, { language, timezone, currency, logoUrl });
    setCompany({ ...company, language, timezone, currency, logoUrl });
  };

  const saveStep2 = async () => {
    if (!machineName) return;
    await addDoc(collection(db, 'machines'), {
      companyId: company.id,
      siteId: userProfile.siteIds[0] || company.id,
      name: machineName,
      type: machineType || 'other',
      department: machineLocation || null,
      status: 'active',
      criticality: 3,
      healthScore: 100,
      createdAt: serverTimestamp(),
      createdBy: userProfile.id,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.id,
      source: 'onboarding',
    });
  };

  const saveInvite = async () => {
    if (!memberName || (!memberEmail && !memberPhone)) return;
    const token = nanoid(24);
    const inviteRef = doc(db, `companies/${company.id}/pendingInvites/${token}`);
    await setDoc(inviteRef, {
      token,
      companyId: company.id,
      companyName: company.name,
      fullName: memberName,
      role: memberRole,
      email: memberEmail || null,
      phone: memberPhone || null,
      invitedBy: userProfile.id,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    });
  };

  const completeOnboarding = async () => {
    const completedAt = Timestamp.now();
    await updateDoc(doc(db, 'companies', company.id), { onboardingCompletedAt: completedAt });
    await updateDoc(doc(db, `companies/${company.id}/users/${userProfile.id}`), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    setCompany({ ...company, onboardingCompletedAt: completedAt });
    setUserProfile({ ...userProfile, status: 'active' });
  };

  const handleNextStep = async () => {
    setError(null);
    setLoading(true);
    try {
      if (step === 1) {
        await saveStep1();
        setStep(2);
      } else if (step === 2) {
        await saveStep2();
        setStep(3);
      } else if (step === 3) {
        await saveInvite();
        await completeOnboarding();
        setStep(4);
      }
    } catch (err: any) {
      console.error('Onboarding step failed:', err);
      setError({ message: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipStep = async () => {
    setError(null);
    setLoading(true);
    try {
      if (step === 2) {
        setStep(3);
      } else if (step === 3) {
        await completeOnboarding();
        setStep(4);
      }
    } catch (err: any) {
      console.error('Onboarding skip failed:', err);
      setError({ message: err?.message || 'Failed to complete setup.' });
    } finally {
      setLoading(false);
    }
  };

  const trialEndsAt = company.trialEndsAt
    ? new Date(company.trialEndsAt.seconds * 1000).toLocaleDateString()
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="PulseMaint" className="h-16 w-auto mb-3" />
          <div className="text-3xl font-bold mb-2">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
          <p className="text-gray-300">Complete your setup</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full mx-1 transition-colors ${
                  s <= step ? 'bg-[#1A56DB]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-gray-400 text-xs text-center">Step {Math.min(step, 4)} of 4</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Company Setup</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleLogoChange({ target: { files: e.dataTransfer.files } } as any);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-input"
                  />
                  {logoPreview ? (
                    <div>
                      <img src={logoPreview} alt="Logo preview" className="h-24 mx-auto mb-2 object-contain" />
                      <label htmlFor="logo-input" className="text-sm text-[#1A56DB] hover:underline cursor-pointer">
                        Change logo
                      </label>
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <label htmlFor="logo-input" className="text-sm text-[#1A56DB] hover:underline cursor-pointer">
                        Click to upload
                      </label>
                      <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="en">English</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as typeof currency)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                  <option value="AED">AED</option>
                  <option value="SAR">SAR</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Add First Machine</h2>
              <p className="text-sm text-gray-500">Optional — you can do this later from the Machines page.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Machine Name</label>
                <input
                  type="text"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="e.g., CNC Machine #1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Machine Type</label>
                <select
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">Select type</option>
                  <option value="cnc_machine">CNC Machine</option>
                  <option value="conveyor">Conveyor</option>
                  <option value="hydraulic_press">Hydraulic Press</option>
                  <option value="lathe">Lathe</option>
                  <option value="compressor">Compressor</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location / Department</label>
                <input
                  type="text"
                  value={machineLocation}
                  onChange={(e) => setMachineLocation(e.target.value)}
                  placeholder="e.g., Building A, Floor 2"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSkipStep}
                disabled={loading}
                className="w-full text-[#1A56DB] hover:underline text-sm disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Invite Team Member</h2>
              <p className="text-sm text-gray-500">
                Optional — we'll save the invite and send it once email/SMS is configured.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Team member name"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="technician">Technician</option>
                  <option value="maintenance_supervisor">Supervisor</option>
                  <option value="plant_manager">Plant Manager</option>
                  <option value="store_keeper">Store Keeper</option>
                  <option value="hr_officer">HR Officer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="team@company.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="+94 701234567"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSkipStep}
                disabled={loading}
                className="w-full text-[#1A56DB] hover:underline text-sm disabled:opacity-50"
              >
                Skip for now and finish
              </button>
            </div>
          )}

          {step >= 4 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set, {userProfile.fullName}!</h2>
                {trialEndsAt && (
                  <p className="text-gray-600">
                    Your free trial runs until <strong>{trialEndsAt}</strong>
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate(getDashboardRoute(userProfile.role), { replace: true })}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {step < 4 && (
            <div className="flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                  className="flex-1 border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11 disabled:opacity-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNextStep}
                disabled={loading}
                className="flex-1 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center gap-2"
              >
                {loading ? 'Saving...' : step === 3 ? 'Complete Setup' : 'Continue'}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
