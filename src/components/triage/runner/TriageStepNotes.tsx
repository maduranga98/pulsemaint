import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function TriageStepNotes({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-sm text-[#1A56DB] underline"
      >
        {open ? '▲' : '▼'} {t('triage.step_notes')}
      </button>
      {open && (
        <textarea
          className="mt-2 w-full border border-gray-300 rounded-lg p-3 text-[16px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('triage.add_note')}
        />
      )}
    </div>
  );
}
