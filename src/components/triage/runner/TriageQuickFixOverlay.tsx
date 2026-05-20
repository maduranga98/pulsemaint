import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onSubmit: (description: string, machineStatus: string) => void;
  onClose: () => void;
}

export default function TriageQuickFixOverlay({ onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [machineStatus, setMachineStatus] = useState('running');

  return (
    <div className="fixed inset-0 z-50 bg-[#10B981] flex flex-col overflow-y-auto">
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold font-['Sora']">{t('triage.quick_fix_title')}</h1>
          <p className="text-white/80 text-sm mt-1">{t('triage.quick_fix_desc')}</p>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white text-3xl leading-none ml-3">
          ×
        </button>
      </div>

      <div className="px-4 flex flex-col gap-5 pb-8">
        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">
            {t('triage.what_did_operator_do')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border-0 rounded-xl p-3 text-[16px] bg-white/90 focus:outline-none focus:ring-2 focus:ring-white resize-none text-gray-800"
          />
        </div>

        <div>
          <label className="block text-white/80 text-sm font-semibold mb-2">
            {t('triage.machine_status')}
          </label>
          <div className="flex flex-col gap-2">
            {['running', 'stopped', 'needs_monitoring'].map((opt) => (
              <label key={opt} className="flex items-center gap-3 text-white text-[16px] cursor-pointer">
                <input
                  type="radio"
                  name="machineStatus"
                  value={opt}
                  checked={machineStatus === opt}
                  onChange={() => setMachineStatus(opt)}
                  className="w-5 h-5 accent-white"
                />
                {opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => onSubmit(description, machineStatus)}
          disabled={description.trim().length === 0}
          className="w-full min-h-[56px] bg-white text-green-700 font-bold text-[18px] rounded-xl disabled:opacity-40 hover:bg-green-50"
        >
          {t('triage.submit')}
        </button>
      </div>
    </div>
  );
}
