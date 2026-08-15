import { AlertCircle } from 'lucide-react';

interface LightEmptyStateProps {
  message?: string;
  subMessage?: string;
}

export default function LightEmptyState({
  message = 'No data available',
  subMessage,
}: LightEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-700">{message}</p>
      {subMessage && <p className="text-sm text-gray-500 mt-1">{subMessage}</p>}
    </div>
  );
}
