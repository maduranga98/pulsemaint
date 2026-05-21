import { GraduationCap, Award, ClipboardList } from 'lucide-react';

type EmptyStateVariant = 'no_modules' | 'no_certificates' | 'no_assignments';

interface TrainingEmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
}

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  {
    Icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: string }>;
    defaultTitle: string;
    defaultDescription: string;
  }
> = {
  no_modules: {
    Icon: GraduationCap,
    defaultTitle: 'No training assigned yet',
    defaultDescription: 'Your supervisor will assign modules here.',
  },
  no_certificates: {
    Icon: Award,
    defaultTitle: 'No certificates yet',
    defaultDescription: 'Complete your assigned training modules.',
  },
  no_assignments: {
    Icon: ClipboardList,
    defaultTitle: 'No assignments',
    defaultDescription: 'Assign training modules to your team.',
  },
};

export default function TrainingEmptyState({
  variant,
  title,
  description,
}: TrainingEmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const { Icon } = config;
  const displayTitle = title ?? config.defaultTitle;
  const displayDescription = description ?? config.defaultDescription;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{displayTitle}</h3>
      <p className="text-sm text-slate-500 max-w-xs">{displayDescription}</p>
    </div>
  );
}
