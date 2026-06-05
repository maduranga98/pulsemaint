import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import OTPInput from '../../components/auth/OTPInput';
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithPhone,
  confirmOTP,
  loginWithPin,
  changePin,
  authErrorMessages,
  getDashboardRoute,
} from '../../lib/auth';
import { useAuthStore } from '../../store/authStore';
import type { ConfirmationResult } from 'firebase/auth';

const emailLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;

const phoneNumberSchema = z.object({
  countryCode: z.string().min(1, 'Country code is required.'),
  phoneNumber: z.string().min(6, 'Please enter a valid phone number.'),
});

type PhoneNumberForm = z.infer<typeof phoneNumberSchema>;

const employeePinSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required.'),
});

type EmployeePinForm = z.infer<typeof employeePinSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp' | 'pin'>('phone');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPinChangeModal, setShowPinChangeModal] = useState(false);
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [, setOtpCountdown] = useState(0);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const emailForm = useForm<EmailLoginForm>({
    resolver: zodResolver(emailLoginSchema),
  });

  const phoneForm = useForm<PhoneNumberForm>({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: { countryCode: '+94' },
  });

  const pinForm = useForm<EmployeePinForm>({
    resolver: zodResolver(employeePinSchema),
  });

  const handleEmailLogin = async (data: EmailLoginForm) => {
    try {
      setError(null);
      setLoading(true);
      const profile = await loginWithEmail(data.email, data.password);
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || err.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setGoogleLoading(true);
      const profile = await loginWithGoogle();
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || err.message || 'Google login failed.';
      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePhoneSubmit = async (data: PhoneNumberForm) => {
    try {
      setError(null);
      setLoading(true);
      const fullPhoneNumber = `${data.countryCode}${data.phoneNumber.replace(/^\+?\d+/, '').replace(/\D/g, '')}`;
      const result = await loginWithPhone(fullPhoneNumber);
      setConfirmationResult(result);
      setPhoneStep('otp');
      setOtpCountdown(60);
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || 'Failed to send OTP.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    if (!confirmationResult) return;
    try {
      setError(null);
      setLoading(true);
      const profile = await confirmOTP(confirmationResult, otp);
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode] || 'OTP verification failed.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (companyId: string) => {
    if (pinInput.length !== 6) return;
    try {
      setError(null);
      setLoading(true);
      const profile = await loginWithPin(companyId, pinInput);
      navigate(getDashboardRoute(profile.role), { replace: true });
    } catch (err: any) {
      const errorCode = err.code || err.message;
      if (errorCode === 'PIN_CHANGE_REQUIRED') {
        setCurrentCompanyId(companyId);
        setCurrentUserId(useAuthStore.getState().user?.uid || '');
        setShowPinChangeModal(true);
      } else {
        const errorMessage = authErrorMessages[errorCode] || 'PIN login failed.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="PulseMaint" className="h-16 w-auto mb-3" />
          <div className="text-3xl font-bold">
            <span className="text-white">Pulse</span>
            <span className="text-[#00C2FF]">Maint</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => {
                setActiveTab('email');
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Email / Google
            </button>
            <button
              onClick={() => {
                setActiveTab('phone');
                setError(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'phone'
                  ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Phone / PIN
            </button>
          </div>

          {activeTab === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  {...emailForm.register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
                {emailForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <a href="/forgot-password" className="text-sm text-[#1A56DB] hover:underline">
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <input
                    {...emailForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {emailForm.formState.errors.password && (
                  <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.password.message}</p>
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>

              <button
                onClick={emailForm.handleSubmit(handleEmailLogin)}
                disabled={loading}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">— or continue with —</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 h-11"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {activeTab === 'phone' && (
            <div className="space-y-4">
              <div>
                <div className="flex gap-2 mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => {
                      setPhoneStep('phone');
                      setError(null);
                    }}
                    className={`text-sm font-medium pb-2 ${
                      phoneStep === 'phone'
                        ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Phone + OTP
                  </button>
                  <button
                    onClick={() => {
                      setPhoneStep('pin');
                      setError(null);
                    }}
                    className={`text-sm font-medium pb-2 ${
                      phoneStep === 'pin'
                        ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Employee PIN
                  </button>
                </div>

                {phoneStep === 'phone' && (
                  <div className="space-y-4">
                    {!confirmationResult ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                          <div className="flex gap-2">
                            <select
                              {...phoneForm.register('countryCode')}
                              className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                            >
                              <option value="+94">🇱🇰 +94</option>
                              <option value="+1">🇺🇸 +1</option>
                              <option value="+44">🇬🇧 +44</option>
                              <option value="+91">🇮🇳 +91</option>
                              <option value="+971">🇦🇪 +971</option>
                            </select>
                            <input
                              {...phoneForm.register('phoneNumber')}
                              type="tel"
                              placeholder="701234567"
                              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            />
                          </div>
                          {phoneForm.formState.errors.phoneNumber && (
                            <p className="text-red-500 text-sm mt-1">{phoneForm.formState.errors.phoneNumber.message}</p>
                          )}
                        </div>

                        <div ref={recaptchaRef} id="recaptcha-container"></div>

                        <button
                          onClick={phoneForm.handleSubmit(handlePhoneSubmit)}
                          disabled={loading}
                          className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center"
                        >
                          {loading ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mb-4">
                          Enter the 6-digit OTP sent to your phone
                        </p>
                        <OTPInput length={6} onComplete={handleOTPComplete} />
                        <button
                          onClick={() => {
                            setConfirmationResult(null);
                            setPhoneStep('phone');
                            setError(null);
                          }}
                          className="text-sm text-[#1A56DB] hover:underline"
                        >
                          Change number
                        </button>
                      </>
                    )}
                  </div>
                )}

                {phoneStep === 'pin' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company ID</label>
                      <input
                        {...pinForm.register('companyId')}
                        placeholder="Enter company ID"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                      />
                      {pinForm.formState.errors.companyId && (
                        <p className="text-red-500 text-sm mt-1">{pinForm.formState.errors.companyId.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Employee PIN</label>
                      <OTPInput length={6} masked onComplete={(value) => setPinInput(value)} />
                    </div>

                    <button
                      onClick={() => {
                        const companyId = pinForm.getValues('companyId');
                        if (pinInput.length === 6 && companyId) {
                          handlePinLogin(companyId);
                        }
                      }}
                      disabled={loading || pinInput.length !== 6}
                      className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm">
          Don't have an account?{' '}
          <a href="/register" className="text-[#1A56DB] hover:underline font-medium">
            Register your company
          </a>
        </p>
      </div>

      {showPinChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Change Your PIN</h3>
            <p className="text-gray-600 text-sm mb-6">You must change your PIN before continuing.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New PIN</label>
                <OTPInput length={6} masked onComplete={(value) => setNewPin(value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm PIN</label>
                <OTPInput length={6} masked onComplete={(value) => setConfirmPin(value)} />
              </div>

              {newPin && confirmPin && newPin !== confirmPin && (
                <p className="text-red-500 text-sm">PINs do not match.</p>
              )}

              <button
                onClick={async () => {
                  try {
                    setError(null);
                    setPinChangeLoading(true);
                    await changePin(currentUserId, currentCompanyId, newPin);
                    setShowPinChangeModal(false);
                    setNewPin('');
                    setConfirmPin('');
                    const userRole = useAuthStore.getState().userProfile?.role;
                    if (userRole) navigate(getDashboardRoute(userRole));
                  } catch (err: any) {
                    setError(err.message || 'Failed to change PIN.');
                  } finally {
                    setPinChangeLoading(false);
                  }
                }}
                disabled={!newPin || !confirmPin || newPin !== confirmPin || pinChangeLoading}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-10"
              >
                {pinChangeLoading ? 'Updating...' : 'Update PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
