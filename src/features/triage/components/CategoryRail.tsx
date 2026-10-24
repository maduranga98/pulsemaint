import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import type { TriageCategory } from '../types';
import { TriageCategoryIcon } from '../triageIcons';

interface Props {
  cats: TriageCategory[];
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (id: string) => void;
}

/** Desktop topic list: one big, easy-to-hit row per category. */
export function CategoryRail({ cats, counts, selected, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('common.triage.knowledge.categoryRail.categoriesHeading')}
      className="w-[230px] shrink-0 flex flex-col gap-1"
    >
      <div
        className="text-[10px] font-bold uppercase tracking-wider px-2 pb-1"
        style={{ color: '#a7b6d3' }}
      >
        {t('common.triage.knowledge.page.pickTopic')}
      </div>
      {cats.map((cat) => {
        const active = selected === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(cat.id)}
            className="w-full text-left flex items-center gap-2.5 px-3 min-h-[40px] rounded-lg text-[13px] transition-colors"
            style={{
              background: active ? '#12203d' : 'transparent',
              border: `2px solid ${active ? cat.color : 'transparent'}`,
              color: active ? '#ffffff' : '#cbd5ea',
              fontWeight: active ? 700 : 500,
            }}
          >
            <span style={{ color: cat.color }} className="shrink-0">
              <TriageCategoryIcon icon={cat.icon} className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0 truncate">{cat.title}</span>
            {cat.pinned && <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: '#6b7fa3' }} />}
            <span className="text-xs shrink-0" style={{ color: '#8BA3BF' }}>
              {counts[cat.id] ?? 0}
            </span>
          </button>
        );
      })}
      {cats.length === 0 && (
        <div className="text-sm text-center py-6" style={{ color: '#6b7fa3' }}>
          {t('common.triage.knowledge.categoryRail.noCategories')}
        </div>
      )}
    </nav>
  );
}
