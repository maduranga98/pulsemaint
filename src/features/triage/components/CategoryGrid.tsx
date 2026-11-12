import { useTranslation } from 'react-i18next';
import type { TriageCategory } from '../types';
import { TriageCategoryIcon } from '../triageIcons';

interface Props {
  cats: TriageCategory[];
  counts: Record<string, number>;
  onSelect: (id: string) => void;
}

/** Phone topic picker: big tiles, one tap opens the guides. */
export function CategoryGrid({ cats, counts, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <section aria-label={t('common.triage.knowledge.page.pickTopic')} className="space-y-2.5">
      <h2 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--tri-muted-2)' }}>
        {t('common.triage.knowledge.page.pickTopic')}
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {cats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="flex flex-col items-start gap-1 p-3 min-h-[88px] rounded-lg text-left"
            style={{
              background: 'var(--tri-card)',
              border: '1px solid var(--tri-line-2)',
              borderTop: `4px solid ${cat.color}`,
            }}
          >
            <span style={{ color: cat.color }}>
              <TriageCategoryIcon icon={cat.icon} className="w-5 h-5" />
            </span>
            <span className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--tri-ink)' }}>
              {cat.title}
            </span>
            <span className="text-xs" style={{ color: 'var(--tri-muted-2)' }}>
              {t('common.triage.knowledge.page.guidesCount', { count: counts[cat.id] ?? 0 })}
            </span>
          </button>
        ))}
      </div>
      {cats.length === 0 && (
        <div className="text-sm text-center py-6" style={{ color: 'var(--tri-muted)' }}>
          {t('common.triage.knowledge.categoryRail.noCategories')}
        </div>
      )}
    </section>
  );
}
