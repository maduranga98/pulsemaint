/** jsPDF's addImage needs a format matching the actual image data — a data URL's mime type tells us which. */
export function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/.exec(dataUrl);
  const type = (match?.[1] ?? 'png').toLowerCase();
  if (type === 'jpg' || type === 'jpeg') return 'JPEG';
  if (type === 'webp') return 'WEBP';
  return 'PNG';
}
