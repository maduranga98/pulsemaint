import { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { sendPasswordReset, authErrorMessages, authErrorKey } from '../../lib/auth';

const forgotSchema = z.object({
  email: z.string().email('common.auth.login.errors.invalidEmail'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [, setResendCountdown] = useState(0);

  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const handleSubmit = async (data: ForgotForm) => {
    try {
      setLoading(true);
      await sendPasswordReset(data.email);
      setSubmittedEmail(data.email);
      setSubmitted(true);
      setResendCountdown(60);
    } catch (err: any) {
      const errorCode = err.code || err.message;
      const errorMessage = authErrorMessages[errorCode]
        ? t(authErrorKey(errorCode), { defaultValue: authErrorMessages[errorCode] })
        : err.message || t('common.auth.forgot.errors.sendFailed');
      form.setError('email', { message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('common.auth.forgot.checkEmailTitle')}</h2>
              <p className="text-gray-600">
                {t('common.auth.forgot.sentPrefix')} <strong>{submittedEmail}</strong>. {t('common.auth.forgot.linkExpires')}
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <button
                onClick={() => {
                  setSubmitted(false);
                  form.reset();
                }}
                className="w-full border border-gray-200 bg-white text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors h-11"
              >
                {t('common.auth.forgot.tryDifferent')}
              </button>

              <a
                href="/login"
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors h-11 flex items-center justify-center"
              >
                {t('common.auth.forgot.backToSignIn')}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('common.auth.forgot.title')}</h2>
            <p className="text-gray-600">{t('common.auth.forgot.subtitle')}</p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {form.formState.errors.email && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{t(form.formState.errors.email.message ?? '')}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.auth.login.emailLabel')}</label>
              <input
                {...form.register('email')}
                type="email"
                placeholder="you@company.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11"
            >
              {loading ? t('common.auth.forgot.sending') : t('common.auth.forgot.send')}
            </button>
          </form>

          <a href="/login" className="text-center text-sm text-[#1A56DB] hover:underline block">
            {t('common.auth.forgot.backToSignIn')}
          </a>
        </div>
      </div>
    </div>
  );
}
