import { ClipboardCheck, Siren, Wrench } from 'lucide-react';

interface JobTypeIconProps {
  type?: string;
}

export function JobTypeIcon({ type = '' }: JobTypeIconProps) {
  const normalized = type.toLowerCase();
  const Icon = normalized.includes('breakdown') ? Siren : normalized.includes('pm') || normalized.includes('preventive') ? ClipboardCheck : Wrench;
  return <Icon className="h-4 w-4 text-blue-600" />;
}

export default JobTypeIcon;
