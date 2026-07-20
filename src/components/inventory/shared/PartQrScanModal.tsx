import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X } from 'lucide-react';

interface PartQrScanModalProps {
  title?: string;
  onScan: (partNumber: string) => void;
  onClose: () => void;
}

const READER_ID = 'part-qr-scan-reader';

// Parses the payload written by PartQrModal — JSON { type: 'inventory_part',
// id, partNumber } — falling back to treating the raw scanned text as the
// part number for QR codes / labels that just encode the number directly.
function extractPartNumber(decodedText: string): string {
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed && typeof parsed === 'object' && typeof parsed.partNumber === 'string') {
      return parsed.partNumber;
    }
  } catch {
    /* not JSON — treat as a raw part number */
  }
  return decodedText.trim();
}

export function PartQrScanModal({ title = 'Scan Part QR', onScan, onClose }: PartQrScanModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          onScan(extractPartNumber(decodedText));
        },
        () => {},
      )
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to open camera.');
        }
      });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div id={READER_ID} className="overflow-hidden rounded-xl bg-black min-h-[250px]" />
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
