import { useEffect, useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
// @ts-expect-error -- no type declarations for qrcode
import QRCode from 'qrcode';
import { downloadQRCodeAsImage, printQRCode } from '@/lib/machineQr';
import type { InventoryPart } from '@/types/inventory';

interface Props {
  part: InventoryPart;
  onClose: () => void;
}

/**
 * PM-060 — Each part has a unique QR code that can be viewed, printed, or scanned.
 * The encoded payload identifies the part for stock-change scanning.
 */
export function PartQrModal({ part, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = JSON.stringify({ type: 'inventory_part', id: part.id, partNumber: part.partNumber });

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, { width: 220, margin: 1 }, (err: unknown) => {
      if (err) console.error('Failed to render part QR', err);
    });
  }, [payload]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Part QR Code</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div id="part-qr-print-container" className="my-4 flex flex-col items-center gap-2 p-4 bg-white">
          <canvas ref={canvasRef} />
          <p className="font-mono text-sm font-semibold text-gray-800">{part.partNumber}</p>
          <p className="text-center text-xs text-gray-500">{part.name}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => canvasRef.current && downloadQRCodeAsImage(canvasRef.current, part.partNumber)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('part-qr-print-container');
              if (el) printQRCode(el);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default PartQrModal;
