import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import LowStockPartsChartLight from '../../components/dashboard/inventory/LowStockPartsChartLight';
import TopUsedPartsChartLight from '../../components/dashboard/inventory/TopUsedPartsChartLight';
import MostMovedPartsChartLight from '../../components/dashboard/inventory/MostMovedPartsChartLight';
import SupplierPoCountsChartLight from '../../components/dashboard/inventory/SupplierPoCountsChartLight';
import PoReceiptQualityChartLight from '../../components/dashboard/inventory/PoReceiptQualityChartLight';

const DURATION_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
] as const;

type TabId = 'low_stock' | 'reasons' | 'most_moved' | 'suppliers' | 'receipt_quality';

const TABS: { id: TabId; label: string }[] = [
  { id: 'low_stock', label: 'Low Stock Parts' },
  { id: 'reasons', label: 'Parts Requested By Reason' },
  { id: 'most_moved', label: 'Most Moved Parts' },
  { id: 'suppliers', label: 'Purchase Orders By Supplier' },
  { id: 'receipt_quality', label: 'Parts Received: Good vs Rejected/Damaged' },
];

// Store keeper's Analytics tab — the parts-usage charts that used to live on
// their dashboard, kept on a light background with larger/higher-contrast
// text instead of the app's default dark analytics theme, for readability.
// Shown one at a time behind a tab bar (rather than stacked) so each chart
// gets the full card width to lay out its labels/axes without crowding.
export default function InventoryAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [days, setDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<TabId>('low_stock');

  return (
    <div className="min-h-full bg-gray-50">
      <div className="px-4 py-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-[Sora]">Inventory Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Stock health, parts request reasons, movement, and supplier/PO activity over the selected period.
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

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'low_stock' && <LowStockPartsChartLight companyId={companyId} />}
        {activeTab === 'reasons' && <TopUsedPartsChartLight companyId={companyId} days={days} />}
        {activeTab === 'most_moved' && <MostMovedPartsChartLight companyId={companyId} days={days} />}
        {activeTab === 'suppliers' && <SupplierPoCountsChartLight companyId={companyId} days={days} />}
        {activeTab === 'receipt_quality' && <PoReceiptQualityChartLight companyId={companyId} days={days} />}
      </div>
    </div>
  );
}
