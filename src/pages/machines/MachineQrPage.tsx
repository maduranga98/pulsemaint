import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { generateMachineQrUrl, downloadQRCodeAsImage, printQRCode } from '../../lib/machineQr';

export function MachineQrPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machine, loading, error } = useMachine({ siteId, machineId: id ?? '' });

  if (!userProfile || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading QR code...</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">QR Code Not Available</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  const qrUrl = generateMachineQrUrl(machine.id, siteId);

  const handleDownloadPng = () => {
    if (qrCanvasRef.current) {
      downloadQRCodeAsImage(qrCanvasRef.current, machine.id);
    }
  };

  // Generate QR code on canvas (using qrcode library when available)
  const generateQrCanvas = () => {
    if (qrCanvasRef.current && typeof window !== 'undefined') {
      const ctx = qrCanvasRef.current.getContext('2d');
      if (ctx) {
        // Placeholder: Draw a simple grid pattern
        // In production, use 'qrcode' npm library to generate actual QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 300, 300);
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.fillText('QR Code', 130, 150);
        ctx.fillText('(Install qrcode library)', 90, 170);
      }
    }
  };

  const handlePrint = () => {
    const element = document.getElementById('qr-print-container');
    if (element) {
      printQRCode(element);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">QR Code</h1>
          <p className="text-gray-600 text-sm mt-1">{machine.name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QR Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div id="qr-print-container" className="flex flex-col items-center gap-6 p-8 bg-white">
                {/* PulseMaint Logo placeholder */}
                <div className="text-sm font-semibold text-gray-600">PulseMaint</div>

                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <canvas
                    ref={qrCanvasRef}
                    id="machine-qr-code"
                    width={300}
                    height={300}
                    className="w-full border border-gray-300"
                    onLoad={generateQrCanvas}
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Note: Install 'qrcode' library for actual QR generation
                  </p>
                </div>

                {/* Machine Info */}
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900">{machine.name}</h3>
                  <p className="text-xs text-gray-600">ID: {machine.id}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {machine.department}
                    {machine.bay && ` · Bay ${machine.bay}`}
                    {machine.station && ` · Station ${machine.station}`}
                  </p>
                </div>

                {/* Scan instruction */}
                <div className="text-xs text-gray-600 text-center">
                  Scan to report breakdown
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">QR Code Actions</h3>

              <div className="space-y-3">
                <button
                  onClick={handleDownloadPng}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Download QR (PNG)
                </button>

                <button
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 opacity-50 cursor-not-allowed font-medium text-sm"
                  title="Coming soon - Cloud Function"
                >
                  Download QR (PDF)
                </button>

                <button
                  onClick={handlePrint}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Print
                </button>

                {userProfile.role === 'admin' && (
                  <button
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 opacity-50 cursor-not-allowed font-medium text-sm"
                    title="Coming soon"
                  >
                    Regenerate QR
                  </button>
                )}
              </div>
            </div>

            {/* QR Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">QR Code Details</h3>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-gray-600">Type:</dt>
                  <dd className="text-gray-900 font-medium">URL</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Size:</dt>
                  <dd className="text-gray-900 font-medium">300x300px</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Format:</dt>
                  <dd className="text-gray-900 font-medium">QR Code (Level H)</dd>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-600 mb-1">URL:</dt>
                  <dd className="text-xs text-gray-900 break-all font-mono bg-gray-50 p-2 rounded">
                    {qrUrl}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/app/machines/${machine.id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            Back to Machine Profile
          </button>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            Back to Registry
          </button>
        </div>
      </div>
    </div>
  );
}
