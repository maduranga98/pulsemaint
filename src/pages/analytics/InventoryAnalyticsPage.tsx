import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import PartsUsageTrendChartLight from '../../components/dashboard/inventory/PartsUsageTrendChartLight';
import TopUsedPartsChartLight from '../../components/dashboard/inventory/TopUsedPartsChartLight';
import MostMovedPartsChartLight from '../../components/dashboard/inventory/MostMovedPartsChartLight';

const DURATION_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
] as const;

// Store keeper's Analytics tab — the parts-usage charts that used to live on
// their dashboard, kept on a light background with larger/higher-contrast
// text instead of the app's default dark analytics theme, for readability.
export default function InventoryAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [days, setDays] = useState<number>(30);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="px-4 py-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Sora]">Inventory Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Parts request trends, reasons, and movement over the selected period.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm shadow-sm">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                days === opt.days ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <PartsUsageTrendChartLight companyId={companyId} days={days} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopUsedPartsChartLight companyId={companyId} days={days} />
          <MostMovedPartsChartLight companyId={companyId} days={days} />
        </div>
      </div>
    </div>
  );
}
