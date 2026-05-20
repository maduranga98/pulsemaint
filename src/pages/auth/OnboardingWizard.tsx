import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { upload_file } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getDashboardRoute } from '../../lib/auth';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const userProfile = useAuthStore((state) => state.userProfile);
  const company = useAuthStore((state) => state.company);
  const userRole = useAuthStore((state) => state.userProfile?.role);

  // Step 1 state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [currency, setCurrency] = useState('LKR');

  // Step 2 state
  const [machineName, setMachineName] = useState('');
  const [machineType, setMachineType] = useState('');
  const [machineLocation, setMachineLocation] = useState('');

  // Step 3 state
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('technician');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!userProfile || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      setLoading(true);
      try {
        // Update company profile
        const companyRef = doc(db, 'companies', company.id);
        await updateDoc(companyRef, {
          language,
          timezone,
          currency,
          logoUrl: logoFile ? 'uploaded' : company.logoUrl,
        });
        setStep(2);
      } catch (err: any) {
        setError(err.message || 'Failed to update company.');
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      // Skip or add machine
      if (machineName) {
        setLoading(true);
        try {
          // Create machine in Firestore
          // For now, we'll skip this as machines are handled elsewhere
          setStep(3);
        } finally {
          setLoading(false);
        }
      } else {
        setStep(3);
      }
    } else if (step === 3) {
      // Invite member
      if (memberName && (memberEmail || memberPhone)) {
        setLoading(true);
        try {
          // Send invite via Cloud Function
          // For now, marking as complete
          const companyRef = doc(db, 'companies', company.id);
          await updateDoc(companyRef, {
            onboardingCompletedAt: Timestamp.now(),
          });
          setStep(4);
        } catch (err: any) {
          setError(err.message || 'Failed to send invite.');
        } finally {
          setLoading(false);
        }
      } else {
        // Complete without inviting
        const companyRef = doc(db, 'companies', company.id);
        await updateDoc(companyRef, {
          onboardingCompletedAt: Timestamp.now(),
        });
        setStep(4);
      }
    }
  };

  const trialEndsAt = company.trialEndsAt
    ? new Date(company.trialEndsAt.seconds * 1000).toLocaleDateString()
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-4">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
          <p className="text-gray-300">Complete your setup</p>
        </div>

        {/* Progress */}
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
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Company Setup</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
                      <img src={logoPreview} alt="Logo preview" className="h-24 mx-auto mb-2" />
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
                  onChange={(e) => setCurrency(e.target.value)}
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
                  <option value="cnc">CNC Machine</option>
                  <option value="conveyor">Conveyor Belt</option>
                  <option value="press">Hydraulic Press</option>
                  <option value="lathe">Lathe</option>
                  <option value="compressor">Compressor</option>
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
                onClick={() => setStep(3)}
                className="w-full text-[#1A56DB] hover:underline text-sm"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Invite Team Member</h2>

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
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="technician">Technician</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="plant_manager">Plant Manager</option>
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
                onClick={handleNextStep}
                className="w-full text-[#1A56DB] hover:underline text-sm"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set, {userProfile.fullName}!</h2>
                <p className="text-gray-600">
                  Your free trial runs until <strong>{trialEndsAt}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => userRole && navigate(getDashboardRoute(userRole))}
                  className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="flex gap-4">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11"
                >
                  Back
                </button>
              )}
              <button
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
