import { useId, useState } from 'react';
import { ChevronRight, Loader2, PenLine, QrCode, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { getSafetyCard } from '@/services/contractorSafetyTraining.service';
import type { ContractorSafetyCard } from '@/lib/safety/contractorSafety';
import ReportSafetyCaseModal from './ReportSafetyCaseModal';
import ScanSafetyCardModal from './ScanSafetyCardModal';

type Step = 'choose' | 'scan' | 'report';

/**
 * "Report a safety case": first choose how — scan a contractor's Safety Card
 * (the case is raised against that person and their company) or fill the
 * report in manually — then carry on into the matching form.
 */
export default function ReportSafetyCaseFlow({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const titleId = useId();
  const [step, setStep] = useState<Step>('choose');
  const [card, setCard] = useState<ContractorSafetyCard | null>(null);
  const [opening, setOpening] = useState(false);

  async function openCard(cardId: string) {
    setStep('choose');
    setOpening(true);
    try {
      const found = await getSafetyCard(cardId);
      if (!found || found.companyId !== companyId) {
        toast.error(t('common.safetyCases.scan.notFound'));
        return;
      }
      setCard(found);
      setStep('report');
    } catch (err) {
      console.error('Failed to load safety card', err);
      toast.error(t('common.safetyCases.scan.notFound'));
    } finally {
      setOpening(false);
    }
  }

  if (step === 'scan') {
    return <ScanSafetyCardModal onClose={() => setStep('choose')} onScan={(cardId) => void openCard(cardId)} />;
  }
  if (step === 'report') {
    return <ReportSafetyCaseModal card={card} onClose={onClose} />;
  }

  const option =
    'group flex w-full items-center gap-4 rounded-xl border border-[#1E3A5F] bg-[#0A1628] p-4 text-left transition-colors hover:border-[#1A56DB] focus:outline-none focus-visible:border-[#1A56DB] focus-visible:ring-2 focus-visible:ring-[#1A56DB]/40 disabled:cursor-wait disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-[#F0F4F8]">
              {t('common.safetyCases.reportFlow.title')}
            </h2>
            <p className="mt-0.5 text-sm text-[#8BA3BF]">{t('common.safetyCases.reportFlow.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8BA3BF] hover:text-white"
            aria-label={t('common.safetyCases.reportFlow.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <button type="button" className={option} disabled={opening} onClick={() => setStep('scan')}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#F59E0B]">
              {opening ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#F0F4F8]">{t('common.safetyCases.reportFlow.qr.title')}</span>
              <span className="mt-0.5 block text-xs text-[#8BA3BF]">{t('common.safetyCases.reportFlow.qr.description')}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#8BA3BF] group-hover:text-white" />
          </button>

          <button type="button" className={option} disabled={opening} onClick={() => { setCard(null); setStep('report'); }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1A56DB]/15 text-[#5B8DEF]">
              <PenLine className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#F0F4F8]">{t('common.safetyCases.reportFlow.manual.title')}</span>
              <span className="mt-0.5 block text-xs text-[#8BA3BF]">{t('common.safetyCases.reportFlow.manual.description')}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#8BA3BF] group-hover:text-white" />
          </button>
        </div>

        <button type="button" onClick={onClose} className="mt-4 w-full py-2 text-sm text-[#8BA3BF] hover:text-white">
          {t('common.safetyCases.reportFlow.cancel')}
        </button>
      </div>
    </div>
  );
}
