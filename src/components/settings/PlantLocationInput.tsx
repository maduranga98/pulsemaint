import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import type { PlantLocation } from '../../types/plant';

interface PlantLocationInputProps {
  value: PlantLocation | null;
  onChange: (location: PlantLocation | null) => void;
}

/**
 * Address field for a plant. When VITE_GOOGLE_MAPS_API_KEY is configured,
 * this becomes a Google Places autocomplete search that resolves to a
 * lat/lng + place_id; otherwise it degrades to a plain text address input
 * (formattedAddress only, no coordinates) so plant creation still works
 * without a Maps key.
 */
export function PlantLocationInput({ value, onChange }: PlantLocationInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mapsReady, setMapsReady] = useState<boolean | null>(null);
  const [text, setText] = useState(value?.formattedAddress ?? '');

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled) return;
        setMapsReady(!!google);
        if (google && inputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            fields: ['formatted_address', 'geometry', 'place_id', 'name'],
          });
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const formattedAddress = place.formatted_address ?? place.name ?? inputRef.current?.value ?? '';
            setText(formattedAddress);
            onChange({
              formattedAddress,
              lat: place.geometry?.location?.lat?.() ?? null,
              lng: place.geometry?.location?.lng?.() ?? null,
              placeId: place.place_id ?? null,
            });
          });
        }
      })
      .catch(() => setMapsReady(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualChange(next: string) {
    setText(next);
    onChange(next.trim() ? { formattedAddress: next, lat: null, lng: null, placeId: null } : null);
  }

  return (
    <div>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder={
            mapsReady
              ? t('common.settings.plants.locationSearchPlaceholder', 'Search for the plant address…')
              : t('common.settings.plants.addressPlaceholder', 'Plant address')
          }
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {value?.lat != null && value?.lng != null && (
        <p className="mt-1 text-xs text-slate-400">
          {t('common.settings.plants.locationCoords', 'Located at {{lat}}, {{lng}}', {
            lat: value.lat.toFixed(5),
            lng: value.lng.toFixed(5),
          })}
        </p>
      )}
      {mapsReady === false && (
        <p className="mt-1 text-xs text-slate-400">
          {t('common.settings.plants.mapSearchUnavailable', 'Map search isn’t configured — enter the address manually.')}
        </p>
      )}
    </div>
  );
}
