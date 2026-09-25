import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { useTranslation } from 'react-i18next';
import { registerCompany, authErrorMessages, authErrorKey } from '../../lib/auth';
import LanguageSwitcher from '../../components/layout/LanguageSwitcher';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../lib/firebase';

const registerSchema = z
  .object({
    companyName: z.string().min(2, 'common.auth.register.errors.companyName'),
    industry: z.string().min(1, 'common.auth.register.errors.industry'),
    country: z.string().min(1, 'common.auth.register.errors.country'),
    fullName: z.string().min(2, 'common.auth.register.errors.fullName'),
    jobTitle: z.string().min(2, 'common.auth.register.errors.jobTitle'),
    email: z.string().email('common.auth.login.errors.invalidEmail'),
    phone: z.string().min(10, 'common.auth.register.errors.phone'),
    password: z
      .string()
      .min(8, 'common.auth.errors.auth_weak_password')
      .regex(/[A-Z]/, 'common.auth.register.errors.uppercase')
      .regex(/\d/, 'common.auth.register.errors.number'),
    confirmPassword: z.string(),
    terms: z.boolean().refine((val) => val === true, 'common.auth.register.errors.terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'common.auth.invite.errors.mismatch',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

// Stored values stay English; labels are translated at render.
const INDUSTRIES = [
  'Manufacturing',
  'Food & Beverage',
  'Textile & Garment',
  'Pharmaceutical',
  'Industrial Warehouse',
  'Electronics Assembly',
  'Heavy Engineering',
  'Other',
];

const COUNTRIES = [
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
];

const INDUSTRY_KEYS: Record<string, string> = {
  Manufacturing: 'manufacturing',
  'Food & Beverage': 'foodBeverage',
  'Textile & Garment': 'textile',
  Pharmaceutical: 'pharmaceutical',
  'Industrial Warehouse': 'warehouse',
  'Electronics Assembly': 'electronics',
  'Heavy Engineering': 'heavyEngineering',
  Other: 'other',
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const handleSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true);
      const { userProfile, company } = await registerCompany({
        companyName: data.companyName,
        industry: data.industry,
        country: data.country,
        fullName: data.fullName,
        jobTitle: data.jobTitle,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      // Hydrate auth store immediately so /app/onboarding doesn't get stuck
      // on its "Loading..." gate. The onAuthStateChanged listener races with
      // the Firestore writes and may have already set these to null.
      const store = useAuthStore.getState();
      if (auth.currentUser) store.setUser(auth.currentUser);
      store.setUserProfile(userProfile);
      store.setCompany(company);
      store.setInitialized(true);
      store.setLoading(false);

      navigate('/app/onboarding', { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode]
        ? t(authErrorKey(errorCode), { defaultValue: authErrorMessages[errorCode] })
        : err.message || t('common.auth.register.errors.failed');
      form.setError('email', { message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.svg" alt="FirmiCore" className="h-16 w-auto mb-3" />
          <div className="text-3xl font-bold mb-2">
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
          <p className="text-gray-300">{t('common.auth.register.subtitle')}</p>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
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
          <p className="text-gray-400 text-xs text-center">{t('common.auth.register.stepOf', { step, total: 4 })}</p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {form.formState.errors.email?.message && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{t(form.formState.errors.email.message ?? '')}</span>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('common.auth.register.companyInfo')}</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.companyName')}</label>
                  <input
                    {...form.register('companyName')}
                    placeholder={t('common.auth.register.companyNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.companyName.message ?? '')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.industry')}</label>
                  <select
                    {...form.register('industry')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="">{t('common.auth.register.selectIndustry')}</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {t(`common.auth.register.industries.${INDUSTRY_KEYS[ind]}`, { defaultValue: ind })}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.industry && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.industry.message ?? '')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.country')}</label>
                  <select
                    {...form.register('country')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="">{t('common.auth.register.selectCountry')}</option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {t(`common.auth.register.countries.${country.code}`, { defaultValue: country.name })}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.country && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.country.message ?? '')}</p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('common.auth.register.yourDetails')}</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.invite.fullNameLabel')}</label>
                  <input
                    {...form.register('fullName')}
                    placeholder={t('common.auth.register.fullNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.fullName.message ?? '')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.jobTitle')}</label>
                  <input
                    {...form.register('jobTitle')}
                    placeholder={t('common.auth.register.jobTitlePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.jobTitle && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.jobTitle.message ?? '')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.workEmail')}</label>
                  <input
                    {...form.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.email.message ?? '')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.register.phone')}</label>
                  <input
                    {...form.register('phone')}
                    type="tel"
                    placeholder="+94 701234567"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.phone.message ?? '')}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('common.auth.register.setPassword')}</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <input
                      {...form.register('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-500"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.password.message ?? '')}</p>
                  )}
                </div>

                <PasswordStrength
                  password={form.watch('password') || ''}
                  confirmPassword={form.watch('confirmPassword') || ''}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.invite.confirmPasswordLabel')}</label>
                  <div className="relative">
                    <input
                      {...form.register('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-500"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{t(form.formState.errors.confirmPassword.message ?? '')}</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('common.auth.register.agreement')}</h2>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    {...form.register('terms')}
                    type="checkbox"
                    className="mt-1 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {t('common.auth.register.agreePrefix')}{' '}
                    <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] hover:underline">
                      {t('common.auth.register.terms')}
                    </a>{' '}
                    {t('common.auth.register.and')}{' '}
                    <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] hover:underline">
                      {t('common.auth.register.privacy')}
                    </a>
                  </span>
                </label>
                {form.formState.errors.terms && (
                  <p className="text-red-500 text-sm">{t(form.formState.errors.terms.message ?? '')}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11"
              >
                {t('common.auth.register.back')}
              </button>
            )}

            <button
              type={step === 4 ? 'submit' : 'button'}
              onClick={() => {
                if (step < 4) {
                  if (step === 1) {
                    form.trigger(['companyName', 'industry', 'country']).then((valid) => {
                      if (valid) setStep(2);
                    });
                  } else if (step === 2) {
                    form.trigger(['fullName', 'jobTitle', 'email', 'phone']).then((valid) => {
                      if (valid) setStep(3);
                    });
                  } else if (step === 3) {
                    form.trigger(['password', 'confirmPassword']).then((valid) => {
                      if (valid) setStep(4);
                    });
                  }
                }
              }}
              disabled={loading && step === 4}
              className="flex-1 bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11 flex items-center justify-center gap-2"
            >
              {step === 4 ? (loading ? t('common.auth.register.creating') : t('common.auth.register.create')) : t('common.auth.register.continue')}
              {step < 4 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          {t('common.auth.invite.haveAccount')}{' '}
          <a href="/login" className="text-[#1A56DB] hover:underline font-medium">
            {t('common.auth.register.signIn')}
          </a>
        </p>
      </div>
    </div>
  );
}
