import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { MachineStatusBadge, MachineCriticalityBadge, MachineHealthScore } from '../../components/machines';
import { formatDate } from '../../lib/dateUtils';
import { MachineHistoryTimeline } from '../../components/workorders/MachineHistoryTimeline';
import { BreakdownHistoryList } from '../../components/machines/BreakdownHistoryList';
import { RcaHistoryList } from '../../components/machines/RcaHistoryList';
import { IsolationPointsTab } from '../../components/machines/IsolationPointsTab';
import { ConditionMonitoringTab } from '../../components/machines/ConditionMonitoringTab';

type TabName = 'overview' | 'documents' | 'history' | 'maintenance' | 'analytics' | 'isolation' | 'condition';

export function MachineProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machine, loading, error } = useMachine({ siteId, machineId: id ?? '' });

  if (!userProfile || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading machine details...</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Machine Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  const canEditMachine =
    userProfile.role === 'supervisor' || userProfile.role === 'plant_manager' || userProfile.role === 'admin';

  const tabs: { name: TabName; label: string }[] = [
    { name: 'overview', label: 'Overview' },
    { name: 'documents', label: 'Documents & Photos' },
    { name: 'history', label: 'Breakdown History' },
    { name: 'maintenance', label: 'Maintenance History' },
    { name: 'analytics', label: 'Analytics' },
    { name: 'isolation', label: 'Isolation Points' },
    { name: 'condition', label: 'Condition Monitoring' },
  ];

  const analyticsTabDisabled = userProfile.role !== 'plant_manager' && userProfile.role !== 'admin';

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{machine.name}</h1>
              <p className="text-gray-600 text-sm mt-1">
                {machine.model} • SN: {machine.serialNumber}
              </p>
              <p className="text-gray-600 text-sm">
                {machine.department}
                {machine.floor && ` · Floor ${machine.floor}`}
                {machine.bay && ` · Bay ${machine.bay}`}
                {machine.station && ` · Station ${machine.station}`}
              </p>
            </div>

            <div className="flex gap-2">
              <MachineStatusBadge status={machine.status} size="lg" />
              <MachineCriticalityBadge criticality={machine.criticality} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Health Score Banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <MachineHealthScore score={machine.healthScore} variant="gauge" />
            </div>
            <div className="text-sm">
              <p className="text-gray-600 mb-2">
                <span className="font-medium">Last Service:</span> {
                  machine.lastServiceDate
                    ? formatDate(machine.lastServiceDate.toDate?.() || new Date((machine.lastServiceDate as any).seconds * 1000))
                    : 'Never'
                }
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Last Service Type:</span> {machine.lastServiceType || 'N/A'}
              </p>
            </div>
            <div className="text-sm">
              {machine.nextPmDue ? (
                <>
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium">Next PM Due:</span> {formatDate(machine.nextPmDue.toDate?.() || new Date((machine.nextPmDue as any).seconds * 1000))}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Days Remaining:</span> Check date logic
                  </p>
                </>
              ) : (
                <p className="text-gray-600">
                  <span className="font-medium">Next PM:</span> Not scheduled
                </p>
              )}
            </div>
          </div>

          {canEditMachine && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate(`/app/machines/${machine.id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Edit Machine
              </button>
              <button
                onClick={() => navigate(`/app/machines/${machine.id}/qr`)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                View QR Code
              </button>
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  More ▾
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                    <button
                      onClick={() => { navigate(`/app/work-orders?create=1&machineId=${machine.id}`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Create Work Order
                    </button>
                    <button
                      onClick={() => { navigate(`/app/breakdowns/report?machineId=${machine.id}`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Report Issue
                    </button>
                    <button
                      onClick={() => { window.print(); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Print Details
                    </button>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => { navigate(`/app/machines/${machine.id}/edit?action=decommission`); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Decommission Machine
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 border-b border-gray-200 bg-white">
          {tabs.map((tab) => {
            const isDisabled = tab.name === 'analytics' && analyticsTabDisabled;
            return (
              <button
                key={tab.name}
                onClick={() => {
                  if (!isDisabled) setActiveTab(tab.name);
                }}
                disabled={isDisabled}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.name
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && <OverviewTab machine={machine} />}
        {activeTab === 'documents' && <DocumentsTab machine={machine} />}
        {activeTab === 'history' && <HistoryTab machine={machine} />}
        {activeTab === 'maintenance' && <MaintenanceTab machine={machine} />}
        {activeTab === 'analytics' && <AnalyticsTab machine={machine} />}
        {activeTab === 'isolation' && (
          <IsolationPointsTab machine={machine} canEdit={canEditMachine} />
        )}
        {activeTab === 'condition' && (
          <ConditionMonitoringTab machine={machine} />
        )}
      </div>
    </div>
  );
}

// Tab Components
function OverviewTab({ machine }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Machine Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Machine Details</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Name:</dt>
            <dd className="font-medium text-gray-900">{machine.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Type:</dt>
            <dd className="font-medium text-gray-900">{machine.type.replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Manufacturer:</dt>
            <dd className="font-medium text-gray-900">{machine.manufacturer}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Model:</dt>
            <dd className="font-medium text-gray-900">{machine.model || 'N/A'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Serial Number:</dt>
            <dd className="font-medium text-gray-900">{machine.serialNumber || 'N/A'}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-3">
            <dt className="text-gray-600">Purchase Date:</dt>
            <dd className="font-medium text-gray-900">
              {machine.purchaseDate ? formatDate(machine.purchaseDate.toDate?.() || new Date((machine.purchaseDate as any).seconds * 1000)) : 'N/A'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Installation Date:</dt>
            <dd className="font-medium text-gray-900">
              {machine.installationDate ? formatDate(machine.installationDate.toDate?.() || new Date((machine.installationDate as any).seconds * 1000)) : 'N/A'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Location */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Location</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Department:</dt>
            <dd className="font-medium text-gray-900">{machine.department}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Floor:</dt>
            <dd className="font-medium text-gray-900">{machine.floor || 'N/A'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Bay:</dt>
            <dd className="font-medium text-gray-900">{machine.bay || 'N/A'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Station:</dt>
            <dd className="font-medium text-gray-900">{machine.station || 'N/A'}</dd>
          </div>
        </dl>
      </div>

      {/* Status & Health */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Status & Health</h3>
        <div className="space-y-4">
          <div>
            <p className="text-gray-600 text-sm mb-2">Status:</p>
            <MachineStatusBadge status={machine.status} size="md" />
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">Criticality:</p>
            <MachineCriticalityBadge criticality={machine.criticality} size="md" />
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">Health Score:</p>
            <MachineHealthScore score={machine.healthScore} variant="bar" />
          </div>
        </div>
      </div>

      {/* Warranty */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Warranty</h3>
        {machine.warrantyItems && machine.warrantyItems.length > 0 ? (
          <ul className="space-y-2">
            {machine.warrantyItems.map((item: any, idx: number) => (
              <li key={idx} className="text-sm">
                <p className="font-medium text-gray-900">{item.partName}</p>
                <p className="text-gray-600">Expires: {formatDate(item.expiryDate.toDate?.() || new Date((item.expiryDate as any).seconds * 1000))}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 text-sm">No warranty items</p>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ machine }: any) {
  const photos: string[] = machine.photos ?? [];
  const documents: any[] = machine.documents ?? [];
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Photos</h3>
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noreferrer" className="block group">
                <img
                  src={url}
                  alt={`Machine photo ${idx + 1}`}
                  className="aspect-square rounded-lg object-cover w-full border border-gray-200 group-hover:opacity-90 transition"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No photos uploaded</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Documents</h3>
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc: any, idx: number) => (
              <div key={idx} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-600">{doc.type}</p>
                </div>
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No documents uploaded</p>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ machine }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <BreakdownHistoryList machineId={machine.id} machineName={machine.name} />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Root Cause Analyses</h3>
        <RcaHistoryList machineId={machine.id} />
      </div>
    </div>
  );
}

function MaintenanceTab({ machine }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <MachineHistoryTimeline machineId={machine.id} machineName={machine.name} />
    </div>
  );
}

function AnalyticsTab({ machine: _machine }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Analytics</h3>
      <p className="text-gray-600 text-sm">Coming soon - Machine analytics and charts</p>
    </div>
  );
}
