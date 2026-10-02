/**
 * The largest rectangle of the given width:height ratio that fits inside a
 * source image, as source-pixel coordinates. Horizontally it is always
 * centred. Vertically `focusY` picks where the spare height is trimmed from:
 * 0 keeps the top, 1 the bottom, 0.5 centres — a head-and-shoulders photo
 * wants a value above 0.5 so the crop trims more from the bottom than from
 * above the head.
 */
export function cropRect(
  sw: number,
  sh: number,
  aspect: number,
  focusY = 0.5,
): { sx: number; sy: number; cw: number; ch: number } {
  let cw = sw;
  let ch = sw / aspect;
  if (ch > sh) {
    ch = sh;
    cw = sh * aspect;
  }
  const focus = Math.min(1, Math.max(0, focusY));
  return { sx: (sw - cw) / 2, sy: (sh - ch) * focus, cw, ch };
}

/**
 * Crops an image (data URL) to the given width:height ratio so it fills a
 * fixed frame without being stretched — a square or landscape picture dropped
 * into a portrait photo box would otherwise be distorted.
 *
 * Browser only (uses a canvas). Anywhere a canvas isn't available, or if the
 * image can't be decoded, the original is returned unchanged.
 */
export async function cropToAspect(dataUrl: string, aspect: number, maxEdge = 600, focusY = 0.5): Promise<string> {
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

    const { sx, sy, cw, ch } = cropRect(sw, sh, aspect, focusY);

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
