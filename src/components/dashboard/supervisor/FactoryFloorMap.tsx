import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useFactoryFloorAttention } from '../../../hooks/dashboard/useFactoryFloorAttention';
import { usePlantNameLookup } from '../../../hooks/usePlantNameLookup';
import PlantBadge from '../shared/PlantBadge';
import { FLOOR_BREAKDOWN_COLOR, dominantWoType, floorWoTypeColor } from '../../../lib/factoryFloor';

interface FactoryFloorMapProps {
  companyId: string;
}

// Indication only: machines with an open breakdown (red) or a started work
// order (coloured by its type), until that work is signed off and closed.
// Machines running normally are not shown.
export default function FactoryFloorMap({ companyId }: FactoryFloorMapProps) {
  const { t } = useTranslation();
  const { machines: attention, loading, error } = useFactoryFloorAttention(companyId);
  const plantName = usePlantNameLookup();

  const typeLabel = (woType: string) =>
    t(`common.workOrders.types.${woType}`, { defaultValue: woType.replace(/_/g, ' ').toLowerCase() });

  const tiles = useMemo(
    () =>
      attention.map((m) => {
        const types = Array.from(new Set(m.wos.map((w) => w.woType)));
        const isBreakdown = m.currentStatus === 'breakdown';
        const color = isBreakdown ? FLOOR_BREAKDOWN_COLOR : floorWoTypeColor(dominantWoType(types));
        return { m, types, isBreakdown, color };
      }),
    [attention],
  );

  const legend = useMemo(() => {
    const seen = new Set<string>();
    let hasBreakdown = false;
    tiles.forEach(({ types, isBreakdown }) => {
      if (isBreakdown) hasBreakdown = true;
      types.forEach((ty) => seen.add(ty));
    });
    return { hasBreakdown, types: [...seen] };
  }, [tiles]);

  return (
    <DashboardWidget
      title={t('common.dashboard.floorMap.title')}
      loading={loading}
      error={error}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.dashboard.floorMap.needAttention', { count: attention.length })}</span>}
    >
      {attention.length === 0 ? (
        <EmptyState message={t('common.dashboard.floorMap.empty')} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#8BA3BF]">
            {legend.hasBreakdown && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FLOOR_BREAKDOWN_COLOR }} />
                {t('common.dashboard.floorMap.statusBreakdown')}
              </span>
            )}
            {legend.types.map((ty) => (
              <span key={ty} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: floorWoTypeColor(ty) }} />
                {typeLabel(ty)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto p-0.5">
            {tiles.map(({ m, types, isBreakdown, color }) => (
              <div
                key={m.machineId}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isBreakdown ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: `${color}14`, borderColor: `${color}55` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{m.machineName}</p>
                  <p className="truncate text-[11px]" style={{ color }}>
                    {isBreakdown
                      ? t('common.dashboard.floorMap.statusBreakdown')
                      : types.map(typeLabel).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {m.openWoCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color, backgroundColor: `${color}26` }}>
                      {m.openWoCount} WO
                    </span>
                  )}
                  <PlantBadge name={plantName(m.plantId)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
