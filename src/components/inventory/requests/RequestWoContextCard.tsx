import { Link } from 'react-router-dom';
import { Wrench, AlertTriangle, MapPin } from 'lucide-react';
import type { PartsRequest } from '@/types/inventory';

interface RequestWoContextCardProps {
  request: PartsRequest;
}

const woTypeBgColor: Record<string, string> = {
  corrective: 'bg-red-100 text-red-700',
  preventive: 'bg-blue-100 text-blue-700',
  predictive: 'bg-purple-100 text-purple-700',
  emergency: 'bg-orange-100 text-orange-700',
};

export function RequestWoContextCard({ request }: RequestWoContextCardProps) {
  const woTypeColor = request.workOrderType
    ? (woTypeBgColor[request.workOrderType.toLowerCase()] ?? 'bg-gray-100 text-gray-700')
    : 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      {request.isContractorJob && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Contractor Job — {request.contractorCompany ?? 'External Company'}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {request.workOrderNumber ? (
          <Link
            to={`/app/work-orders/${request.workOrderId}`}
            className="font-semibold text-blue-700 hover:underline text-base"
          >
            WO #{request.workOrderNumber}
          </Link>
        ) : (
          <span className="text-gray-500 text-sm">No Work Order linked</span>
        )}

        {request.workOrderType && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${woTypeColor}`}>
            {request.workOrderType.charAt(0).toUpperCase() + request.workOrderType.slice(1)}
          </span>
        )}

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            request.priorityLevel === 'critical' || request.priorityLevel === 'high'
              ? 'bg-red-100 text-red-700'
              : request.priorityLevel === 'medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {request.priorityLevel.charAt(0).toUpperCase() + request.priorityLevel.slice(1)} Priority
        </span>
      </div>

      {(request.machineName) && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Wrench className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{request.machineName}</span>
        </div>
      )}
    </div>
  );
}
