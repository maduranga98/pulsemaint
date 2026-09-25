import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthProps {
  password: string;
  confirmPassword?: string;
}

export default function PasswordStrength({ password, confirmPassword }: PasswordStrengthProps) {
  const { t } = useTranslation();
  const checks = [
    {
      label: t('common.auth.password.minLength'),
      passed: password.length >= 8,
    },
    {
      label: t('common.auth.password.uppercase'),
      passed: /[A-Z]/.test(password),
    },
    {
      label: t('common.auth.password.number'),
      passed: /\d/.test(password),
    },
    ...(confirmPassword !== undefined
      ? [
          {
            label: t('common.auth.password.match'),
            passed: password === confirmPassword && password.length > 0,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2 text-sm">
      {checks.map((check, index) => (
        <div key={index} className="flex items-center gap-2">
          {check.passed ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Circle className="w-4 h-4 text-gray-300" />
          )}
          <span className={check.passed ? 'text-green-600' : 'text-gray-500'}>{check.label}</span>
        </div>
      ))}
    </div>
  );
}
