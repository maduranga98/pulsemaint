import { useTranslation } from 'react-i18next';

interface Section6SafetyIncidentsProps {
  safetyIncidentOccurred: boolean;
  safetyIncidentDescription: string;
  restrictedAreas: string;
  temporaryRepairs: string;
  onChange: (updates: {
    safetyIncidentOccurred?: boolean;
    safetyIncidentDescription?: string;
    restrictedAreas?: string;
    temporaryRepairs?: string;
  }) => void;
}

export function Section6SafetyIncidents(props: Section6SafetyIncidentsProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section6SafetyIncidents.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section6SafetyIncidents.subtitle')}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex min-h-12 items-center gap-3 text-sm font-semibold text-slate-900">
          <input
            type="checkbox"
            checked={props.safetyIncidentOccurred}
            onChange={(event) => props.onChange({ safetyIncidentOccurred: event.target.checked })}
          />
          {t('common.shiftHandovers.createForm.section6SafetyIncidents.incidentQuestion')}
        </label>
        {props.safetyIncidentOccurred && (
          <textarea
            value={props.safetyIncidentDescription}
            onChange={(event) => props.onChange({ safetyIncidentDescription: event.target.value })}
            placeholder={t('common.shiftHandovers.createForm.section6SafetyIncidents.incidentDescriptionPlaceholder')}
            className="mt-3 min-h-28 w-full rounded-md border border-red-200 px-3 py-2 text-sm"
          />
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <textarea value={props.restrictedAreas} onChange={(event) => props.onChange({ restrictedAreas: event.target.value })} placeholder={t('common.shiftHandovers.createForm.section6SafetyIncidents.restrictedAreasPlaceholder')} className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={props.temporaryRepairs} onChange={(event) => props.onChange({ temporaryRepairs: event.target.value })} placeholder={t('common.shiftHandovers.createForm.section6SafetyIncidents.temporaryRepairsPlaceholder')} className="min-h-24 rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
    </section>
  );
}

export default Section6SafetyIncidents;
