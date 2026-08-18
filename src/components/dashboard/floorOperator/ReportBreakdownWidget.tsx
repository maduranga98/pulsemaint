import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertTriangle, QrCode, X } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';

// Quick-action entry point to reporting a breakdown, mirroring the two ways
// a floor operator can start a report elsewhere in the app: scan the
// machine's QR code (same in-page camera scanner BreakdownsPage uses) or go
// straight to the form and pick the machine manually.
export default function ReportBreakdownWidget() {
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function openScanner() {
    setScanError(null);
    setShowScanner(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('floor-operator-qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await scanner.stop();
            scannerRef.current = null;
            setShowScanner(false);
            try {
              const url = new URL(decodedText);
              const machineId = url.searchParams.get('machineId');
              if (machineId) {
                navigate(`/app/breakdowns/report?machineId=${machineId}`);
              } else {
                setScanError('QR code did not contain a valid machine ID.');
              }
            } catch {
              setScanError('That QR code is not a machine QR code.');
            }
          },
          () => {},
        );
      } catch (err: any) {
        setScanError(err?.message || 'Failed to open camera.');
        setShowScanner(false);
      }
    }, 100);
  }

  async function closeScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* already stopped */
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  }

  return (
    <DashboardWidget title="Report a Breakdown">
      {scanError && (
        <div className="mb-3 flex items-center gap-2 text-sm text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/app/breakdowns/report')}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Report a Breakdown
        </button>
        <button
          type="button"
          onClick={openScanner}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1A56DB] hover:bg-[#1442ad] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <QrCode className="w-4 h-4" />
          Scan QR Code
        </button>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Scan Machine QR Code</h3>
              <button type="button" onClick={closeScanner} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div id="floor-operator-qr-reader" className="w-full" />
            <p className="text-xs text-slate-500 mt-3 text-center">
              Point your camera at a machine QR code to auto-select the machine.
            </p>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
