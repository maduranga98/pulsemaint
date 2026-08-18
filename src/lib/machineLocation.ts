/**
 * Combines a machine's floor/bay/station into one "exact location" string,
 * e.g. "Floor Ground · Bay B1 · Station 3". Machine has no single `location`
 * field of its own — floor/bay/station are the only location data it
 * carries — so every breakdown/WO/report flow that needs a human-readable
 * location must derive it from these three, not just pick the first
 * non-empty one (which silently drops detail when more than one is set).
 */
export function formatMachineLocation(
  floor?: string | null,
  bay?: string | null,
  station?: string | null,
): string {
  return [
    floor ? `Floor ${floor}` : null,
    bay ? `Bay ${bay}` : null,
    station ? `Station ${station}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
