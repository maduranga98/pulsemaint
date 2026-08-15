import { useAuthStore } from '../../store/authStore';
import PartsUsageTrendChartLight from '../../components/dashboard/inventory/PartsUsageTrendChartLight';
import TopUsedPartsChartLight from '../../components/dashboard/inventory/TopUsedPartsChartLight';
import MostMovedPartsChartLight from '../../components/dashboard/inventory/MostMovedPartsChartLight';

// Store keeper's Analytics tab — the parts-usage charts that used to live on
// their dashboard, kept on a light background with larger/higher-contrast
// text instead of the app's default dark analytics theme, for readability.
export default function InventoryAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  return (
    <div className="min-h-full bg-gray-50">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-gray-900 font-[Sora]">Inventory Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Parts request trends, reasons, and movement over the last 30 days.
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <PartsUsageTrendChartLight companyId={companyId} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopUsedPartsChartLight companyId={companyId} />
          <MostMovedPartsChartLight companyId={companyId} />
        </div>
      </div>
    </div>
  );
}
