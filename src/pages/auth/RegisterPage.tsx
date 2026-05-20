import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PasswordStrength from '../../components/auth/PasswordStrength';
import { registerCompany, authErrorMessages } from '../../lib/auth';

const registerSchema = z
  .object({
    companyName: z.string().min(2, 'Company name must be at least 2 characters.'),
    industry: z.string().min(1, 'Please select an industry.'),
    country: z.string().min(1, 'Please select a country.'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
    jobTitle: z.string().min(2, 'Job title is required.'),
    email: z.string().email('Please enter a valid email address.'),
    phone: z.string().min(10, 'Please enter a valid phone number.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter.')
      .regex(/\d/, 'Password must contain at least 1 number.'),
    confirmPassword: z.string(),
    terms: z.boolean().refine((val) => val === true, 'You must agree to the terms.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

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

export default function RegisterPage() {
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
      await registerCompany({
        companyName: data.companyName,
        industry: data.industry,
        country: data.country,
        fullName: data.fullName,
        jobTitle: data.jobTitle,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      navigate('/app/onboarding');
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || err.message || 'Registration failed.';
      form.setError('email', { message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-4">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
          <p className="text-gray-300">Create your free account</p>
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
          <p className="text-gray-400 text-xs text-center">Step {step} of 4</p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {form.formState.errors.email?.message && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{form.formState.errors.email.message}</span>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Information</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company / Factory Name</label>
                  <input
                    {...form.register('companyName')}
                    placeholder="Enter your company name"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.companyName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <select
                    {...form.register('industry')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.industry && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.industry.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    {...form.register('country')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.country && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.country.message}</p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Details</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    {...form.register('fullName')}
                    placeholder="Your full name"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.fullName && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                  <input
                    {...form.register('jobTitle')}
                    placeholder="Your job title"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.jobTitle && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.jobTitle.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
                  <input
                    {...form.register('email')}
                    type="email"
                    placeholder="you@company.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    {...form.register('phone')}
                    type="tel"
                    placeholder="+94 701234567"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Set Your Password</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
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
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <PasswordStrength
                  password={form.watch('password') || ''}
                  confirmPassword={form.watch('confirmPassword') || ''}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
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
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Agreement</h2>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    {...form.register('terms')}
                    type="checkbox"
                    className="mt-1 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the{' '}
                    <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {form.formState.errors.terms && (
                  <p className="text-red-500 text-sm">{form.formState.errors.terms.message}</p>
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
                Back
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
              {step === 4 ? (loading ? 'Creating Account...' : 'Create Free Account') : 'Continue'}
              {step < 4 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#1A56DB] hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
