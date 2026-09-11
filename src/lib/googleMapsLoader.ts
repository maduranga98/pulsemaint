// Lazily loads the Google Maps JS API (Places library) once, for the plant
// location search field. No-op (resolves null) when no API key is configured
// so the rest of the app works without a Maps key.
//
// Typed as `any` deliberately — this project doesn't depend on
// @types/google.maps, so the Google Maps global is treated as an opaque
// handle that callers narrow themselves (see PlantLocationInput).

declare global {
  interface Window {
    google?: any;
  }
}

let loadPromise: Promise<any | null> | null = null;

export function loadGoogleMaps(): Promise<any | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) return Promise.resolve(null);

  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('google-maps-places-script');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google ?? null));
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-maps-places-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => resolve(window.google ?? null);
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}
