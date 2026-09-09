import { useTranslation } from 'react-i18next';

interface Section7GeneralNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function Section7GeneralNotes({ value, onChange }: Section7GeneralNotesProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section7GeneralNotes.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section7GeneralNotes.subtitle')}</p>
      </div>
      <textarea
        value={value}
        maxLength={2000}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('common.shiftHandovers.createForm.section7GeneralNotes.placeholder')}
        className="min-h-56 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      <p className="text-right text-xs text-slate-500">{t('common.shiftHandovers.createForm.section7GeneralNotes.charCount', { count: value.length })}</p>
    </section>
  );
}

export default Section7GeneralNotes;
