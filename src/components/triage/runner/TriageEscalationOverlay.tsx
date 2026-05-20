import { useTranslation } from 'react-i18next';
import type { TriageEmergencyContact } from '../../../types/triage';

interface Props {
  contacts: TriageEmergencyContact[];
  shutdownProcedure: string;
  onClose: () => void;
  onMarkShutdown: () => void;
}

export default function TriageEscalationOverlay({
  contacts,
  shutdownProcedure,
  onClose,
  onMarkShutdown,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-red-600 flex flex-col overflow-y-auto">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold font-['Sora']">
          {t('triage.emergency_overlay_title')}
        </h1>
        <button onClick={onClose} className="text-white/80 hover:text-white text-3xl leading-none">
          ×
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="px-4 mb-4">
          <h2 className="text-white/80 text-sm font-semibold mb-2 uppercase tracking-wide">
            {t('triage.emergency_contacts')}
          </h2>
          <div className="flex flex-col gap-3">
            {contacts.map((c, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-lg">{c.name}</p>
                  <p className="text-white/70 text-sm">{c.role}</p>
                </div>
                <a
                  href={`tel:${c.phone}`}
                  className="min-h-[56px] px-5 bg-white text-red-600 font-bold rounded-xl flex items-center text-lg"
                >
                  {t('triage.call_contact')}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {shutdownProcedure && (
        <div className="px-4 mb-4">
          <h2 className="text-white/80 text-sm font-semibold mb-2 uppercase tracking-wide">
            {t('triage.shutdown_procedure')}
          </h2>
          <div className="bg-white/10 rounded-xl p-4 text-white text-[16px] leading-relaxed whitespace-pre-line">
            {shutdownProcedure}
          </div>
        </div>
      )}

      <div className="px-4 pb-8 flex flex-col gap-3 mt-auto">
        <button
          onClick={onMarkShutdown}
          className="w-full min-h-[56px] bg-white text-red-700 font-bold text-[18px] rounded-xl hover:bg-red-50"
        >
          {t('triage.mark_shutdown')}
        </button>
        <button
          onClick={onClose}
          className="w-full min-h-[56px] border-2 border-white/40 text-white font-semibold text-[18px] rounded-xl hover:bg-white/10"
        >
          {t('triage.keep_going')}
        </button>
      </div>
    </div>
  );
}
