import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  subMessage?: string;
}

export default function EmptyState({
  message = 'No data available',
  subMessage = 'Data will appear here once it is generated.',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertCircle className="w-10 h-10 text-[#8BA3BF] mb-3" />
      <p className="text-sm font-medium text-[#F0F4F8]">{message}</p>
      {subMessage && <p className="text-xs text-[#8BA3BF] mt-1">{subMessage}</p>}
    </div>
  );
}
