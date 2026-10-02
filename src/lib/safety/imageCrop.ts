/**
 * Crops an image (data URL) to the given width:height ratio, centred, so it
 * fills a fixed frame without being stretched — a square logo or landscape
 * photo dropped into a portrait photo box would otherwise be distorted.
 *
 * Browser only (uses a canvas). Anywhere a canvas isn't available, or if the
 * image can't be decoded, the original is returned unchanged.
 */
export async function cropToAspect(dataUrl: string, aspect: number, maxEdge = 600): Promise<string> {
  if (typeof document === 'undefined' || !(aspect > 0)) return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = dataUrl;
    });
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    if (!sw || !sh) return dataUrl;

    // Largest centred rectangle with the wanted ratio.
    let cw = sw;
    let ch = sw / aspect;
    if (ch > sh) {
      ch = sh;
      cw = sh * aspect;
    }
    const sx = (sw - cw) / 2;
    const sy = (sh - ch) / 2;

    const scale = Math.min(1, maxEdge / Math.max(cw, ch));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cw * scale));
    canvas.height = Math.max(1, Math.round(ch * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.fillStyle = '#FFFFFF'; // a transparent PNG would otherwise turn black as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return dataUrl;
  }
}
