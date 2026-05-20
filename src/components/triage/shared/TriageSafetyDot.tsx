import type { TriageSafetyLevel } from '../../../types/triage';

interface Props {
  level: TriageSafetyLevel;
  size?: 'sm' | 'md';
}

const dotColors: Record<TriageSafetyLevel, string> = {
  safe: 'bg-green-500',
  caution: 'bg-amber-500',
  danger: 'bg-red-500',
};

export default function TriageSafetyDot({ level, size = 'sm' }: Props) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <span
      className={`inline-block rounded-full ${dotColors[level]} ${sizeClass}`}
      title={level}
    />
  );
}
