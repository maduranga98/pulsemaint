import { CheckCircle2, Circle } from 'lucide-react';

interface PasswordStrengthProps {
  password: string;
  confirmPassword?: string;
}

export default function PasswordStrength({ password, confirmPassword }: PasswordStrengthProps) {
  const checks = [
    {
      label: 'At least 8 characters',
      passed: password.length >= 8,
    },
    {
      label: 'At least 1 uppercase letter',
      passed: /[A-Z]/.test(password),
    },
    {
      label: 'At least 1 number',
      passed: /\d/.test(password),
    },
    ...(confirmPassword !== undefined
      ? [
          {
            label: 'Passwords match',
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
