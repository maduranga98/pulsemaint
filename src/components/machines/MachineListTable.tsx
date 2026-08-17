import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Machine } from '../../types/machine';
import { MachineStatusBadge } from './MachineStatusBadge';
import { MachineCriticalityBadge } from './MachineCriticalityBadge';
import { MachineHealthScore } from './MachineHealthScore';
import { formatDistanceToNow, formatDate, isOverdue } from '../../lib/dateUtils';
import { formatMachineTypeLabel } from '../../lib/machineExport';

interface MachineListTableProps {
  machines: Machine[];
  isLoading?: boolean;
  onEdit?: (machine: Machine) => void;
}

export function MachineListTable({ machines, isLoading = false, onEdit }: MachineListTableProps) {
  const { t } = useTranslation();
  if (machines.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('common.machines.listTable.noMachines')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.machine')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.serial')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.location')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.type')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.criticality')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.status')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.health')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.lastService')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.nextPm')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">{t('common.machines.listTable.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => {
            const lastServiceDate = machine.lastServiceDate
              ? machine.lastServiceDate.toDate?.() || new Date((machine.lastServiceDate as any).seconds * 1000)
              : null;

            const nextPmDate = machine.nextPmDue
              ? machine.nextPmDue.toDate?.() || new Date((machine.nextPmDue as any).seconds * 1000)
              : null;

            const isOverduepm = nextPmDate ? isOverdue(nextPmDate) : false;

            return (
              <tr key={machine.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{machine.name}</p>
                    <p className="text-xs text-gray-600">{machine.model}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{machine.serialNumber || '-'}</td>
                <td className="px-4 py-3">
                  <div className="text-xs">
                    <p className="text-gray-900">{machine.department}</p>
                    <p className="text-gray-500">
                      {machine.floor && t('common.machines.listTable.floor', { floor: machine.floor })}
                      {machine.bay && ` · ${t('common.machines.listTable.bay', { bay: machine.bay })}`}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{formatMachineTypeLabel(machine.type)}</span>
                </td>
                <td className="px-4 py-3">
                  <MachineCriticalityBadge criticality={machine.criticality} showLabel={false} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <MachineStatusBadge status={machine.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <MachineHealthScore score={machine.healthScore} variant="compact" showLabel={false} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {lastServiceDate ? formatDistanceToNow(lastServiceDate) : t('common.machines.listTable.never')}
                </td>
                <td className="px-4 py-3">
                  {nextPmDate ? (
                    <span className={`text-xs ${isOverduepm ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatDate(nextPmDate)}
                      {isOverduepm && <span className="ml-1 font-bold">!</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{t('common.machines.listTable.notScheduled')}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link to={`/app/machines/${machine.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                      {t('common.machines.listTable.view')}
                    </Link>
                    <button
                      onClick={() => onEdit?.(machine)}
                      className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                    >
                      {t('common.machines.listTable.edit')}
                    </button>
                    <Link to={`/app/machines/${machine.id}/qr`} className="text-gray-600 hover:text-gray-800 text-xs font-medium">
                      {t('common.machines.listTable.qr')}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
