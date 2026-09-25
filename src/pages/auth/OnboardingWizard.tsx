import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db, storage } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getDashboardRoute } from '../../lib/auth';
import { getTimezoneOptions } from '../../lib/timezones';

type StepError = { message: string } | null;

export default function OnboardingWizard() {
  const { t } = useTranslation();
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
  const timezoneOptions = getTimezoneOptions();
  const [currency, setCurrency] = useState<'LKR' | 'USD' | 'AED' | 'SAR'>('LKR');

  // Step 2
  const [machineName, setMachineName] = useState('');
  const [machineType, setMachineType] = useState('');
  const [machineLocation, setMachineLocation] = useState('');

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
        <div className="text-white">{t('common.ui.loading')}</div>
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
        await completeOnboarding();
        setStep(3);
      }
    } catch (err: any) {
      console.error('Onboarding step failed:', err);
      setError({ message: err?.message || t('common.auth.onboarding.errors.generic') });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipStep = async () => {
    setError(null);
    setLoading(true);
    try {
      if (step === 2) {
        await completeOnboarding();
        setStep(3);
      }
    } catch (err: any) {
      console.error('Onboarding skip failed:', err);
      setError({ message: err?.message || t('common.auth.onboarding.errors.completeFailed') });
    } finally {
      setLoading(false);
    }
  };

  const trialEndsAt = null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.svg" alt="FirmiCore" className="h-16 w-auto mb-3" />
          <div className="text-3xl font-bold mb-2">
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
          <p className="text-gray-300">{t('common.auth.onboarding.subtitle')}</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full mx-1 transition-colors ${
                  s <= step ? 'bg-[#1A56DB]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-gray-400 text-xs text-center">{t('common.auth.register.stepOf', { step: Math.min(step, 3), total: 3 })}</p>
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
              <h2 className="text-2xl font-bold text-gray-900">{t('common.auth.onboarding.companySetup')}</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.companyLogo')}</label>
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
                      <img src={logoPreview} alt={t('common.auth.onboarding.logoPreview')} className="h-24 mx-auto mb-2 object-contain" />
                      <label htmlFor="logo-input" className="text-sm text-[#1A56DB] hover:underline cursor-pointer">
                        {t('common.auth.onboarding.changeLogo')}
                      </label>
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <label htmlFor="logo-input" className="text-sm text-[#1A56DB] hover:underline cursor-pointer">
                        {t('common.auth.onboarding.clickToUpload')}
                      </label>
                      <p className="text-xs text-gray-500 mt-1">{t('common.auth.onboarding.orDragDrop')}</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.language')}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="en">{t('common.auth.onboarding.languages.en')}</option>
                  <option value="si">{t('common.auth.onboarding.languages.si')}</option>
                  <option value="ta">{t('common.auth.onboarding.languages.ta')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.timezone')}</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                >
                  {!timezoneOptions.includes(timezone) && (
                    <option value={timezone}>{timezone}</option>
                  )}
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.currency')}</label>
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
              <h2 className="text-2xl font-bold text-gray-900">{t('common.auth.onboarding.addFirstMachine')}</h2>
              <p className="text-sm text-gray-500">{t('common.auth.onboarding.addFirstMachineHint')}</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.machineName')}</label>
                <input
                  type="text"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder={t('common.auth.onboarding.machineNamePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.machineType')}</label>
                <select
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">{t('common.auth.onboarding.selectType')}</option>
                  <option value="cnc_machine">{t('common.auth.onboarding.types.cnc')}</option>
                  <option value="conveyor">{t('common.auth.onboarding.types.conveyor')}</option>
                  <option value="hydraulic_press">{t('common.auth.onboarding.types.hydraulicPress')}</option>
                  <option value="lathe">{t('common.auth.onboarding.types.lathe')}</option>
                  <option value="compressor">{t('common.auth.onboarding.types.compressor')}</option>
                  <option value="other">{t('common.auth.onboarding.types.other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.onboarding.location')}</label>
                <input
                  type="text"
                  value={machineLocation}
                  onChange={(e) => setMachineLocation(e.target.value)}
                  placeholder={t('common.auth.onboarding.locationPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSkipStep}
                disabled={loading}
                className="w-full text-[#1A56DB] hover:underline text-sm disabled:opacity-50"
              >
                {t('common.auth.onboarding.skip')}
              </button>
            </div>
          )}

          {step >= 3 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('common.auth.onboarding.allSet', { name: userProfile.fullName })}</h2>
                {trialEndsAt && (
                  <p className="text-gray-600">
                    {t('common.auth.onboarding.trialUntil')} <strong>{trialEndsAt}</strong>
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate(getDashboardRoute(userProfile.role), { replace: true })}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11"
              >
                {t('common.auth.unauthorized.goToDashboard')}
              </button>
            </div>
          )}

          {step < 3 && (
            <div className="flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                  className="flex-1 border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11 disabled:opacity-50"
                >
                  {t('common.auth.register.back')}
                </button>
              )}
              <button
                type="button"
                onClick={handleNextStep}
                disabled={loading}
                className="flex-1 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center gap-2"
              >
                {loading ? t('common.auth.onboarding.saving') : step === 2 ? t('common.auth.onboarding.complete') : t('common.auth.register.continue')}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
