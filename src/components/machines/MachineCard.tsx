import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import type { Machine } from '../../types/machine';
import { MachineStatusBadge } from './MachineStatusBadge';
import { MachineCriticalityBadge } from './MachineCriticalityBadge';
import { MachineHealthScore } from './MachineHealthScore';
import { formatDistanceToNow, formatDate } from '../../lib/dateUtils';

interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastServiceDate = machine.lastServiceDate
    ? formatDistanceToNow(machine.lastServiceDate.toDate?.() || new Date((machine.lastServiceDate as any).seconds * 1000))
    : t('common.machines.card.never');

  return (
    <Link to={`/app/machines/${machine.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        {/* Header: Machine name + Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{machine.name}</h3>
            <p className="text-sm text-gray-600">{machine.model}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MachineStatusBadge status={machine.status} size="sm" />
            {/* QR quick-action — reachable directly from the registry, so the
                QR view can be opened on mobile without the desktop table. */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/app/machines/${machine.id}/qr`);
              }}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 hover:text-blue-600"
              aria-label={t('common.machines.card.qrLabel')}
              title={t('common.machines.card.qrLabel')}
            >
              <QrCode className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Serial Number */}
        {machine.serialNumber && (
          <p className="text-xs text-gray-500 mb-2">SN: {machine.serialNumber}</p>
        )}

        {/* Location */}
        <div className="text-sm text-gray-600 mb-3">
          {machine.department}
          {machine.floor && ` · ${t('common.machines.listTable.floor', { floor: machine.floor })}`}
          {machine.bay && ` · ${t('common.machines.listTable.bay', { bay: machine.bay })}`}
        </div>

        {/* Health Score */}
        <div className="mb-4">
          <MachineHealthScore score={machine.healthScore} variant="compact" />
        </div>

        {/* Footer: Metadata badges */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-600">
          <MachineCriticalityBadge criticality={machine.criticality} showLabel={true} size="sm" />
          <div>{t('common.machines.card.lastService', { date: lastServiceDate })}</div>
        </div>

        {machine.nextPmDue && (
          <div className="text-xs mt-2 text-amber-600">
            {t('common.machines.card.nextPmDue', { date: formatDate(machine.nextPmDue.toDate?.() || new Date((machine.nextPmDue as any).seconds * 1000)) })}
          </div>
        )}
      </div>
    </Link>
  );
}
