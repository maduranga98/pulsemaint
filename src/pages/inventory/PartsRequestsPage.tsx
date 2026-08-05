import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { RequestsQueue } from '@/components/inventory/requests/RequestsQueue';
import { CreatePartsRequestModal } from '@/components/inventory/requests/CreatePartsRequestModal';
import { LowStockWidget } from '@/components/inventory/dashboard/LowStockWidget';

const MANAGE_ROLES = ['store_keeper', 'supervisor', 'plant_manager', 'admin'];

export function PartsRequestsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const role = useAuthStore((s) => s.userProfile?.role);
  const canManage = MANAGE_ROLES.includes(role ?? '');
  // Only the roles that can raise a PO from a low-stock alert need to see it
  // here — technicians requesting parts don't act on stock levels.
  const { parts: lowStockParts } = useInventoryParts({ stockStatus: 'low_stock', pageSize: 10 });

  return (
    <div className="space-y-5">
      {showCreate && <CreatePartsRequestModal onClose={() => setShowCreate(false)} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Parts Requests</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {canManage
              ? 'Review and manage parts requests from technicians.'
              : 'Track the parts you’ve requested and their status.'}
          </p>
        </div>
        {canManage ? (
          <Link
            to="/app/inventory/issue/manual"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
          >
            <ScanLine className="w-4 h-4" />
            Scan &amp; Issue
          </Link>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
          >
            + New Request
          </button>
        )}
      </div>
      {canManage && lowStockParts.length > 0 && (
        <LowStockWidget parts={lowStockParts.filter((p) => p.currentStock > 0)} />
      )}
      <RequestsQueue />
    </div>
  );
}
export default PartsRequestsPage;
