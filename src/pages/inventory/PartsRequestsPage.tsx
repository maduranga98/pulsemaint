import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScanLine } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { RequestsQueue } from '@/components/inventory/requests/RequestsQueue';
import { CreatePartsRequestModal } from '@/components/inventory/requests/CreatePartsRequestModal';

const MANAGE_ROLES = ['store_keeper', 'supervisor', 'plant_manager', 'admin'];

export function PartsRequestsPage() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const role = useAuthStore((s) => s.userProfile?.role);
  const canManage = MANAGE_ROLES.includes(role ?? '');

  return (
    <div className="space-y-5">
      {showCreate && <CreatePartsRequestModal onClose={() => setShowCreate(false)} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">{t('common.inventory.requests.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {canManage
              ? t('common.inventory.requests.subtitleManage')
              : t('common.inventory.requests.subtitleOwn')}
          </p>
        </div>
        {canManage ? (
          <Link
            to="/app/inventory/issue/manual"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
          >
            <ScanLine className="w-4 h-4" />
            {t('common.inventory.requests.scanIssue')}
          </Link>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
          >
            {t('common.inventory.requests.newRequest')}
          </button>
        )}
      </div>
      <RequestsQueue />
    </div>
  );
}
export default PartsRequestsPage;
