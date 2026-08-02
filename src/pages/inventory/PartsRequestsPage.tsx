import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { RequestsQueue } from '@/components/inventory/requests/RequestsQueue';
import { CreatePartsRequestModal } from '@/components/inventory/requests/CreatePartsRequestModal';

const MANAGE_ROLES = ['store_keeper', 'supervisor', 'plant_manager', 'admin'];

export function PartsRequestsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const role = useAuthStore((s) => s.userProfile?.role);
  const canManage = MANAGE_ROLES.includes(role ?? '');

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
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
        >
          + New Request
        </button>
      </div>
      <RequestsQueue />
    </div>
  );
}
export default PartsRequestsPage;
