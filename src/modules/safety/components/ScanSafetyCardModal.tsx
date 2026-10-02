import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseSafetyCardScan } from '@/lib/safety/contractorSafety';

interface Props {
  /** Called once with the scanned card's id. */
  onScan: (cardId: string) => void;
  onClose: () => void;
}

const READER_ID = 'safety-card-scan-reader';

/** Camera scanner for a Contractor Safety Card's QR code. Ignores QR codes that aren't safety cards. */
export default function ScanSafetyCardModal({ onScan, onClose }: Props) {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notACard, setNotACard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    let lastRejected = 0;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current) return;
          const cardId = parseSafetyCardScan(decodedText);
          if (!cardId) {
            // Keep scanning — just tell the user this isn't a safety card.
            lastRejected = Date.now();
            setNotACard(true);
            setTimeout(() => {
              if (Date.now() - lastRejected >= 2500) setNotACard(false);
            }, 2600);
            return;
          }
          handledRef.current = true;
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          onScan(cardId);
        },
        () => {},
      )
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.safetyCases.scan.cameraFailed'));
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
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#F59E0B]" />
            <h3 className="font-semibold text-[#F0F4F8]">{t('common.safetyCases.scan.title')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#8BA3BF] hover:text-white"
            aria-label={t('common.safetyCases.scan.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-[#8BA3BF]">{t('common.safetyCases.scan.hint')}</p>
        <div id={READER_ID} className="min-h-[250px] overflow-hidden rounded-xl bg-black" />
        {notACard && (
          <p className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-sm text-[#F59E0B]">
            {t('common.safetyCases.scan.notACard')}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-[#8BA3BF] hover:text-white">
          {t('common.safetyCases.scan.cancel')}
        </button>
      </div>
    </div>
  );
}
