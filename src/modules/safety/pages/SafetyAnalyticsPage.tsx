import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import SafetySnapshotWidget from '@/components/dashboard/manager/SafetySnapshotWidget';

export default function SafetyAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  return (
    <div className="min-h-full bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <h1 className="mb-1 flex items-center gap-2 font-[Sora] text-xl font-bold">
        <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> Safety Analytics
      </h1>
      <p className="mb-5 text-sm text-[#8BA3BF]">Incident trends, types, and severity across the factory.</p>

      <SafetySnapshotWidget companyId={companyId} />
    </div>
  );
}
