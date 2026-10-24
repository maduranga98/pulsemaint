import type { TooltipRenderProps } from 'react-joyride';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * The card that floats next to the highlighted element: step counter, title, text, a progress bar and
 * Previous / Next (Done on the last stop) / Skip buttons. Esc and the × close it.
 */
export default function TourTooltip({
  continuous, index, isLastStep, size, step, backProps, closeProps, primaryProps, skipProps, tooltipProps,
}: TooltipRenderProps) {
  const { t } = useTranslation();
  const progress = Math.round(((index + 1) / size) * 100);
  return (
    <div
      {...tooltipProps}
      role="dialog"
      aria-label={typeof step.title === 'string' ? step.title : undefined}
      className="w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1E35] text-white shadow-2xl shadow-black/50"
    >
      <div className="h-1 bg-[#1E3A5F]" aria-hidden="true">
        <div className="h-full bg-[#1A56DB] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-[#1A56DB]/25 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#93C5FD]">
            {t('tour.ui.stepOf', { current: index + 1, total: size })}
          </span>
          <button
            {...closeProps}
            type="button"
            aria-label={t('tour.ui.close')}
            title={t('tour.ui.close')}
            className="-mr-1 rounded p-1 text-[#8BA3BF] transition-colors hover:bg-[#142849] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {step.title && <h3 className="text-[15px] font-semibold leading-snug text-white">{step.title}</h3>}
        <div className="mt-1.5 text-[13px] leading-relaxed text-white/85">{step.content}</div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {!isLastStep ? (
            <button
              {...skipProps}
              type="button"
              className="rounded px-1 py-1.5 text-xs font-medium text-[#B8C7DB] hover:text-white"
            >
              {t('tour.ui.skip')}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                type="button"
                className="rounded-lg border border-[#2B4170] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#142849]"
              >
                {t('tour.ui.back')}
              </button>
            )}
            <button
              {...primaryProps}
              type="button"
              className="rounded-lg bg-[#1A56DB] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1648B8] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 focus:ring-offset-[#0F1E35]"
            >
              {isLastStep || !continuous ? t('tour.ui.done') : t('tour.ui.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
