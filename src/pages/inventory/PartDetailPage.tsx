import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useInventoryPart } from '@/hooks/inventory/useInventoryPart';
import { PartDetailHeader } from '@/components/inventory/catalog/PartDetailHeader';
import { PartOverviewTab } from '@/components/inventory/catalog/PartOverviewTab';
import { PartStockHistoryTab } from '@/components/inventory/catalog/PartStockHistoryTab';
import { PartQrModal } from '@/components/inventory/catalog/PartQrModal';
import { PartActiveRequestsTab } from '@/components/inventory/catalog/PartActiveRequestsTab';

type TabId = 'overview' | 'history' | 'requests' | 'files' | 'analytics';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Stock History' },
  { id: 'requests', label: 'Active Requests' },
  { id: 'files', label: 'Files' },
  { id: 'analytics', label: 'Analytics' },
];

function SkeletonDetail() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="h-8 w-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}

export function PartDetailPage() {
  const { partId } = useParams<{ partId: string }>();
  const { part, loading, error } = useInventoryPart(partId);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showQr, setShowQr] = useState(false);

  if (loading) return <SkeletonDetail />;

  if (error || !part) {
    return (
      <div className="space-y-4">
        <Link to="/app/inventory/catalog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4" /> Back to Catalog
        </Link>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error ?? 'Part not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        to="/app/inventory/catalog"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Catalog
      </Link>

      {/* Header */}
      <PartDetailHeader part={part} onShowQr={() => setShowQr(true)} />
      {showQr && <PartQrModal part={part} onClose={() => setShowQr(false)} />}

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <PartOverviewTab part={part} />}
        {activeTab === 'history' && <PartStockHistoryTab partId={part.id} />}
        {activeTab === 'requests' && <PartActiveRequestsTab partId={part.id} />}
        {activeTab === 'files' && (
          <div className="space-y-5">
            {[
              { title: 'Warranty Documents', files: part.warrantyDocuments ?? [] },
              { title: 'CAD Files', files: part.cadFiles ?? [] },
              { title: 'Images', files: (part.images ?? []).map((url, i) => ({ name: `Image ${i + 1}`, url })) },
            ].map(({ title, files }) => (
              <div key={title} className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
                {files.length === 0 ? (
                  <p className="text-sm text-gray-400">No {title.toLowerCase()} attached.</p>
                ) : (
                  <ul className="space-y-2">
                    {files.map((f, i) => (
                      <li key={i}>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {activeTab === 'analytics' && (
          <div className="text-sm text-gray-500 py-8 text-center">Usage analytics will appear here.</div>
        )}
      </div>
    </div>
  );
}
export default PartDetailPage;
