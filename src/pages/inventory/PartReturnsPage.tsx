import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Undo2 } from 'lucide-react';
import { usePartReturns } from '@/hooks/inventory/usePartReturns';
import { usePartReturnActions } from '@/hooks/inventory/usePartReturnActions';
import { PartReturnQueueRow } from '@/components/inventory/returns/PartReturnQueueRow';
import type { PartReturnStatus } from '@/types/inventory';

type TabId = PartReturnStatus;

const TABS: { id: TabId; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'returned', label: 'Returned' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function PartReturnsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const { returns, loading } = usePartReturns({ status: activeTab });
  const { confirmReturn: handleConfirm, rejectReturn: handleReject } = usePartReturnActions();

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Link
        to="/app/inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Inventory
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora] flex items-center gap-2">
          <Undo2 className="w-6 h-6 text-purple-600" />
          Parts Returns
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Confirm parts being physically returned to stock by requesters.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="py-12 text-center border border-gray-200 rounded-xl">
          <Undo2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No {activeTab} returns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <PartReturnQueueRow
              key={r.id}
              partReturn={r}
              onConfirm={activeTab === 'pending' ? handleConfirm : undefined}
              onReject={activeTab === 'pending' ? handleReject : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PartReturnsPage;
