import { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

export interface FloorTile {
  m: { machineId: string; machineName: string; plantId?: string | null; openWoCount: number };
  types: string[];
  isBreakdown: boolean;
  color: string;
}

interface FloorZonesProps {
  tiles: FloorTile[];
  typeLabel: (woType: string) => string;
  breakdownLabel: string;
  plantName: (plantId?: string | null) => string | null | undefined;
  zoomIn: string;
  zoomOut: string;
}

const ZOOMS = [1, 1.25, 1.5];

/**
 * The machines that need attention, laid out as a plant floor: one zone per
 * plant, each machine a glowing pin (pulsing ring for a breakdown) with its
 * open work-order count. Same data and wording as the old tile list.
 */
export default function FloorZones({ tiles, typeLabel, breakdownLabel, plantName, zoomIn, zoomOut }: FloorZonesProps) {
  const [zoom, setZoom] = useState(0);
  const zones = useMemo(() => {
    const map = new Map<string, { name: string; items: FloorTile[] }>();
    tiles.forEach((t) => {
      const key = t.m.plantId ?? '';
      const zone = map.get(key) ?? { name: plantName(t.m.plantId) ?? '', items: [] };
      zone.items.push(t);
      map.set(key, zone);
    });
    return [...map.values()];
  }, [tiles, plantName]);

  return (
    <div className="floor-map">
      <div className="floor-map-tools">
        <button type="button" className="floor-map-btn" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label={zoomOut}>
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className="floor-map-btn" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label={zoomIn}>
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="floor-map-scroll">
        <div className="floor-map-grid" style={{ ['--fm-zoom' as string]: ZOOMS[zoom] }}>
          {zones.map((zone, zi) => (
            <section key={zone.name + zi} className="floor-zone" style={{ ['--i' as string]: zi }}>
              {zone.name && <h4 className="floor-zone-name">{zone.name}</h4>}
              <div className="floor-zone-pins">
                {zone.items.map(({ m, types, isBreakdown, color }, pi) => (
                  <div
                    key={m.machineId}
                    className={`floor-pin ${isBreakdown ? 'floor-pin-alert' : ''}`}
                    style={{ ['--pin' as string]: color, ['--i' as string]: pi }}
                    title={isBreakdown ? breakdownLabel : types.map(typeLabel).join(' · ')}
                  >
                    <span className="floor-pin-dot" />
                    <span className="floor-pin-text">
                      <b>{m.machineName}</b>
                      <small>{isBreakdown ? breakdownLabel : types.map(typeLabel).join(' · ')}</small>
                    </span>
                    {m.openWoCount > 0 && <span className="floor-pin-count">{m.openWoCount} WO</span>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
