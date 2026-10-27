import { ClipboardList, GraduationCap, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ActivityKind, PersonActivity } from '../../../lib/dashboard/peopleActivity';

const KIND_STYLE: Record<ActivityKind, { icon: typeof Wrench; cls: string; key: string }> = {
  workOrder: { icon: ClipboardList, cls: 'bg-[#1A56DB]/15 text-[#5B8DEF]', key: 'workOrder' },
  breakdown: { icon: Wrench, cls: 'bg-[#EF4444]/15 text-[#F87171]', key: 'breakdown' },
  training: { icon: GraduationCap, cls: 'bg-[#8B5CF6]/15 text-[#A78BFA]', key: 'training' },
};

/** Small chips saying what a person is doing now — "Idle" when nothing is in progress. */
export default function PersonActivityBadges({ activities }: { activities: PersonActivity[] | undefined }) {
  const { t } = useTranslation();
  if (!activities || activities.length === 0) {
    return <span className="text-[11px] text-[#8BA3BF]">{t('common.widgets.personActivity.idle')}</span>;
  }
  return (
    <>
      {activities.map((a) => {
        const { icon: Icon, cls, key } = KIND_STYLE[a.kind];
        return (
          <span
            key={`${a.kind}-${a.label}`}
            className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
            title={a.label}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {t(`common.widgets.personActivity.${key}`)}
              {a.label ? ` · ${a.label}` : ''}
            </span>
          </span>
        );
      })}
    </>
  );
}
