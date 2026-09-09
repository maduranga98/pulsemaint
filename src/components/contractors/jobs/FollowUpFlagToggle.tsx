import { useTranslation } from 'react-i18next';

interface FollowUpFlagToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function FollowUpFlagToggle({ enabled, onChange }: FollowUpFlagToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
        {t('common.contractors.jobs.followUpFlag.label')}
      </label>
      {enabled && <textarea placeholder={t('common.contractors.jobs.followUpFlag.placeholder')} className="mt-3 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />}
    </div>
  );
}

export default FollowUpFlagToggle;
