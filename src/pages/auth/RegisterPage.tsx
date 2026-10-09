import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ChevronRight, ChevronLeft, Building2, UserRound, KeyRound, FileCheck2, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { useTranslation } from 'react-i18next';
import { registerCompany, authErrorMessages, authErrorKey } from '../../lib/auth';
import LanguageSwitcher from '../../components/layout/LanguageSwitcher';
import TermsCheckbox from '../../components/legal/TermsCheckbox';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../lib/firebase';
import CountryInput from '../../components/common/CountryInput';

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

// Dark form styling shared by every field. The global stylesheet resets
// h*/p margins and colours unlayered, so spacing below uses flex `gap` and
// heading colours use the `!` modifier.
const FIELD =
  'w-full h-11 px-4 rounded-xl border border-white/10 bg-[#0B1526] text-white placeholder:text-slate-500 outline-none transition-all focus:border-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF]/20';
const LABEL = 'block text-sm font-medium text-slate-300 mb-1.5';
const ERROR = 'text-red-400 text-sm mt-1.5';

const STEPS = [
  { icon: Building2, key: 'companyInfo' },
  { icon: UserRound, key: 'yourDetails' },
  { icon: KeyRound, key: 'setPassword' },
  { icon: FileCheck2, key: 'agreement' },
] as const;

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const err = (name: keyof RegisterForm) => {
    const message = form.formState.errors[name]?.message;
    return message ? <p className={ERROR}>{t(message)}</p> : null;
  };

  const next = () => {
    const fields: (keyof RegisterForm)[][] = [
      ['companyName', 'industry', 'country'],
      ['fullName', 'jobTitle', 'email', 'phone'],
      ['password', 'confirmPassword'],
    ];
    void form.trigger(fields[step - 1]).then((valid) => valid && setStep(step + 1));
  };

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { terms: false, country: '' },
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

      // New companies wait for a Lumora superadmin to approve them.
      navigate('/app/pending-approval', { replace: true });
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
    <div className="relative min-h-dvh overflow-x-hidden bg-gradient-to-br from-[#0A1628] via-[#0C1B33] to-[#12335C] px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#1A56DB]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-24 -right-20 h-80 w-80 rounded-full bg-[#00C2FF]/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <a href="/login" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="FirmiCore" className="h-10 w-auto" />
            <span className="text-2xl font-bold"><span className="text-white">Firmi</span><span className="text-[#00C2FF]">Core</span></span>
          </a>
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl text-white! sm:text-3xl" style={{ fontWeight: 700 }}>{t('common.auth.register.subtitle')}</h1>
          <p className="text-sm text-slate-400">{t('common.auth.register.stepOf', { step, total: 4 })}</p>
        </div>

        {/* Stepper */}
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map(({ icon: Icon, key }, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <li key={key} className="flex flex-col gap-2">
                <div className={`h-1.5 rounded-full transition-colors ${n <= step ? 'bg-gradient-to-r from-[#1A56DB] to-[#00C2FF]' : 'bg-white/10'}`} />
                <div className={`flex items-center gap-1.5 text-xs ${active ? 'text-white' : done ? 'text-[#00C2FF]' : 'text-slate-500'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${active ? 'bg-[#1A56DB]' : done ? 'bg-[#00C2FF]/20' : 'bg-white/5'}`}>
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className="hidden truncate sm:inline">{t(`common.auth.register.${key}`)}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
          {form.formState.errors.email?.message && step === 4 && (
            <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-red-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-sm">{t(form.formState.errors.email.message ?? '')}</span>
            </div>
          )}

          <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#0D1B33]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
            <h2 className="flex items-center gap-2 text-lg text-white! sm:text-xl" style={{ fontWeight: 600 }}>
              {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="h-5 w-5 text-[#00C2FF]" />; })()}
              {t(`common.auth.register.${STEPS[step - 1].key}`)}
            </h2>

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={LABEL}>{t('common.auth.register.companyName')}</label>
                  <input {...form.register('companyName')} placeholder={t('common.auth.register.companyNamePlaceholder')} className={FIELD} autoComplete="organization" />
                  {err('companyName')}
                </div>
                <div>
                  <label className={LABEL}>{t('common.auth.register.industry')}</label>
                  <select {...form.register('industry')} className={FIELD}>
                    <option value="">{t('common.auth.register.selectIndustry')}</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{t(`common.auth.register.industries.${INDUSTRY_KEYS[ind]}`, { defaultValue: ind })}</option>
                    ))}
                  </select>
                  {err('industry')}
                </div>
                <div>
                  <label className={LABEL}>{t('common.auth.register.country')}</label>
                  <CountryInput
                    value={form.watch('country') ?? ''}
                    onChange={(v) => form.setValue('country', v, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
                    onBlur={() => void form.trigger('country')}
                    lang={i18n.language}
                    className={FIELD}
                    placeholder={t('common.auth.register.selectCountry')}
                  />
                  {err('country')}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>{t('common.auth.invite.fullNameLabel')}</label>
                  <input {...form.register('fullName')} placeholder={t('common.auth.register.fullNamePlaceholder')} className={FIELD} autoComplete="name" />
                  {err('fullName')}
                </div>
                <div>
                  <label className={LABEL}>{t('common.auth.register.jobTitle')}</label>
                  <input {...form.register('jobTitle')} placeholder={t('common.auth.register.jobTitlePlaceholder')} className={FIELD} autoComplete="organization-title" />
                  {err('jobTitle')}
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>{t('common.auth.register.workEmail')}</label>
                  <input {...form.register('email')} type="email" placeholder="you@company.com" className={FIELD} autoComplete="email" inputMode="email" />
                  {err('email')}
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>{t('common.auth.register.phone')}</label>
                  <input {...form.register('phone')} type="tel" placeholder="+94 701234567" className={FIELD} autoComplete="tel" inputMode="tel" />
                  {err('phone')}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={LABEL}>{t('common.auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <input {...form.register('password')} type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={`${FIELD} pr-11`} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white" aria-label="Show password">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {err('password')}
                </div>
                <div>
                  <label className={LABEL}>{t('common.auth.invite.confirmPasswordLabel')}</label>
                  <div className="relative">
                    <input {...form.register('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" className={`${FIELD} pr-11`} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white" aria-label="Show password">
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {err('confirmPassword')}
                </div>
                <div className="rounded-xl border border-white/5 bg-[#0B1526] p-3">
                  <PasswordStrength tone="dark" password={form.watch('password') || ''} confirmPassword={form.watch('confirmPassword') || ''} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-3">
                <TermsCheckbox
                  tone="dark"
                  checked={!!form.watch('terms')}
                  onChange={(v) => form.setValue('terms', v, { shouldValidate: true })}
                  statement={t('common.legal.terms.registerStatement')}
                />
                {err('terms')}
                <p className="rounded-xl border border-[#00C2FF]/20 bg-[#00C2FF]/5 p-3 text-xs leading-relaxed text-slate-300">
                  {t('common.pendingApproval.registerNote')}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0B1526] font-medium text-slate-100 transition-colors hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common.auth.register.back')}
              </button>
            )}
            <button
              // A separate element on the last step, so the click that
              // advanced to it can never count as a form submit.
              key={step === 4 ? 'submit' : 'next'}
              type={step === 4 ? 'submit' : 'button'}
              onClick={step < 4 ? next : undefined}
              disabled={loading && step === 4}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1A56DB] to-[#1D6FF2] font-semibold text-white shadow-lg shadow-[#1A56DB]/30 transition-all hover:brightness-110 disabled:opacity-60"
            >
              {step === 4 ? (loading ? t('common.auth.register.creating') : t('common.auth.register.create')) : t('common.auth.register.continue')}
              {step < 4 && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-slate-400">
          {t('common.auth.invite.haveAccount')}{' '}
          <a href="/login" className="font-medium text-[#00C2FF]! hover:underline">{t('common.auth.register.signIn')}</a>
        </div>
      </div>
    </div>
  );
}
