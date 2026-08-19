import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// @ts-expect-error -- no type declarations for qrcode
import QRCode from 'qrcode';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';
import { generateMachineQrUrl, downloadQRCodeAsImage, printQRCode } from '../../lib/machineQr';
import { exportMachineQrPdf } from '../../lib/machineExport';

export function MachineQrPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';
  const { machine, loading, error } = useMachine({ siteId, machineId: id ?? '' });

  useEffect(() => {
    if (!machine || !qrCanvasRef.current) return;
    const url = generateMachineQrUrl(machine.id, siteId);
    QRCode.toCanvas(qrCanvasRef.current, url, {
      width: 300,
      errorCorrectionLevel: 'H',
      margin: 1,
    }).catch((err: unknown) => console.error('QR generation failed:', err));
  }, [machine, siteId]);

  if (!userProfile || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.machines.profile.loading')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">{t('common.machines.profile.qr.loading')}</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('common.machines.profile.qr.notAvailable')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('common.machines.profile.qr.backToRegistry')}
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

  const handleDownloadPdf = () => {
    if (qrCanvasRef.current) {
      exportMachineQrPdf(machine, qrCanvasRef.current.toDataURL('image/png'), qrUrl);
    }
  };

  const handlePrint = () => {
    const element = document.getElementById('qr-print-container');
    if (element) {
      printQRCode(element);
    }
  };

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('common.machines.profile.qr.title')}</h1>
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
                {/* FirmiCore Logo placeholder */}
                <div className="text-sm font-semibold text-gray-600">FirmiCore</div>

                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <canvas
                    ref={qrCanvasRef}
                    id="machine-qr-code"
                    width={300}
                    height={300}
                    className="mx-auto h-auto w-full max-w-[280px] border border-gray-300"
                  />
                </div>

                {/* Machine Info */}
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900">{machine.name}</h3>
                  <p className="text-xs text-gray-600">{t('common.machines.profile.qr.idLabel', { id: machine.id })}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {machine.department}
                    {machine.bay && ` · ${t('common.machines.profile.bay', { bay: machine.bay })}`}
                    {machine.station && ` · ${t('common.machines.profile.station', { station: machine.station })}`}
                  </p>
                </div>

                {/* Scan instruction */}
                <div className="text-xs text-gray-600 text-center">
                  {t('common.machines.profile.qr.scanInstruction')}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t('common.machines.profile.qr.actions')}</h3>

              <div className="space-y-3">
                <button
                  onClick={handleDownloadPng}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  {t('common.machines.profile.qr.downloadPng')}
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  {t('common.machines.profile.qr.downloadPdf')}
                </button>

                <button
                  onClick={handlePrint}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  {t('common.machines.profile.qr.print')}
                </button>

                {userProfile.role === 'admin' && (
                  <button
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 opacity-50 cursor-not-allowed font-medium text-sm"
                    title={t('common.machines.profile.qr.comingSoon')}
                  >
                    {t('common.machines.profile.qr.regenerate')}
                  </button>
                )}
              </div>
            </div>

            {/* QR Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">{t('common.machines.profile.qr.details')}</h3>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-gray-600">{t('common.machines.profile.qr.type')}</dt>
                  <dd className="text-gray-900 font-medium">{t('common.machines.profile.qr.typeValue')}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">{t('common.machines.profile.qr.size')}</dt>
                  <dd className="text-gray-900 font-medium">300x300px</dd>
                </div>
                <div>
                  <dt className="text-gray-600">{t('common.machines.profile.qr.format')}</dt>
                  <dd className="text-gray-900 font-medium">{t('common.machines.profile.qr.formatValue')}</dd>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-600 mb-1">{t('common.machines.profile.qr.url')}</dt>
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
            {t('common.machines.profile.qr.backToProfile')}
          </button>
          <button
            onClick={() => navigate('/app/machines')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            {t('common.machines.profile.qr.backToRegistry')}
          </button>
        </div>
      </div>
    </div>
  );
}
