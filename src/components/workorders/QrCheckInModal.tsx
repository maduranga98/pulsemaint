import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X } from 'lucide-react';
import type { WorkOrder } from '../../types/workOrder';

interface QrCheckInModalProps {
  workOrder: WorkOrder;
  onVerified: () => void;
  onClose: () => void;
}

/**
 * Camera QR scanner for technician check-in. The technician scans the QR
 * sticker on the physical machine; check-in only proceeds when the scanned
 * machine matches the work order's machine, proving arrival at the machine.
 */
export function QrCheckInModal({ workOrder, onVerified, onClose }: QrCheckInModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode('wo-checkin-qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current) return;
          // Machine QR codes encode .../scan?machineId={id}&siteId={siteId};
          // also accept a bare machine id.
          let scannedMachineId = decodedText.trim();
          try {
            const url = new URL(decodedText);
            scannedMachineId = url.searchParams.get('machineId') ?? scannedMachineId;
          } catch {
            /* not a URL — treat as a raw machine id */
          }
          if (scannedMachineId === workOrder.machineId) {
            handledRef.current = true;
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            onVerified();
          } else {
            setError(
              `Scanned QR belongs to a different machine. Expected ${workOrder.machineName}.`,
            );
          }
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
  }, [workOrder.machineId, workOrder.machineName, onVerified]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto flex items-start sm:items-center justify-center bg-black/70 p-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Check In at Machine</h3>
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
        <p className="text-sm text-gray-600">
          Scan the QR sticker on <strong>{workOrder.machineName}</strong> to record your arrival
          and start the work order.
        </p>
        <div id="wo-checkin-qr-reader" className="overflow-hidden rounded-xl bg-black min-h-[250px]" />
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
