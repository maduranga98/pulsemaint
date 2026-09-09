import { useTranslation } from 'react-i18next';

interface Section8SignOffProps {
  supervisorName: string;
  shiftName: string;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
}

export function Section8SignOff({ supervisorName, shiftName, acknowledged, onAcknowledge, onSubmit, submitting = false, error = null }: Section8SignOffProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section8SignOff.title')}</h2>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">{t('common.shiftHandovers.createForm.section8SignOff.supervisor')}</dt><dd className="font-semibold text-slate-950">{supervisorName}</dd></div>
          <div><dt className="text-slate-500">{t('common.shiftHandovers.createForm.section8SignOff.shift')}</dt><dd className="font-semibold text-slate-950">{shiftName}</dd></div>
          <div><dt className="text-slate-500">{t('common.shiftHandovers.createForm.section8SignOff.signOffTime')}</dt><dd className="font-semibold text-slate-950">{new Date().toLocaleString()}</dd></div>
        </dl>
        <label className="mt-5 flex min-h-12 items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledge(event.target.checked)} />
          {t('common.shiftHandovers.createForm.section8SignOff.confirmation')}
        </label>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}
        <button
          type="button"
          disabled={!acknowledged || submitting}
          onClick={onSubmit}
          className="mt-4 min-h-12 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
        >
          {submitting ? t('common.shiftHandovers.createForm.section8SignOff.submitting') : t('common.shiftHandovers.createForm.section8SignOff.submit')}
        </button>
      </div>
    </section>
  );
}

export default Section8SignOff;
