import { useTranslation } from 'react-i18next';

interface RatingQuickTagsProps {
  onSelect?: (tag: string) => void;
}

const TAG_KEYS = [
  'arrivedOnTime',
  'neatWorkmanship',
  'explainedIssueWell',
  'leftSiteClean',
  'requiredNoCallbacks',
  'professionalTeam',
] as const;

export function RatingQuickTags({ onSelect }: RatingQuickTagsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      {TAG_KEYS.map((key) => {
        const tag = t(`common.contractors.jobs.ratingQuickTags.${key}`);
        return (
          <button key={key} type="button" onClick={() => onSelect?.(tag)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export default RatingQuickTags;
