import { useMemo, useState } from 'react';
import { Wrench, AlertTriangle, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RecordReference } from '../useRecordReferences';
import { field } from '../requestUi';

type TypeFilter = 'all' | RecordReference['type'];
const MAX_SHOWN = 50;

/** Searchable list of the user's plant / department WOs and breakdowns — pick one. */
export default function RecordReferencePicker({
  records,
  loading,
  error,
  value,
  onChange,
}: {
  records: RecordReference[];
  loading: boolean;
  error: boolean;
  value: RecordReference | null;
  onChange: (r: RecordReference | null) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter(
      (r) => (type === 'all' || r.type === type) && (!term || r.number.toLowerCase().includes(term) || r.machineName.toLowerCase().includes(term)),
    );
  }, [records, search, type]);

  const Icon = (r: RecordReference) => (r.type === 'work_order' ? Wrench : AlertTriangle);

  if (value) {
    const I = Icon(value);
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#1A56DB] bg-[#1A56DB]/10 px-3 py-2">
        <I className="h-4 w-4 shrink-0 text-[#5B8DEF]" />
        <div className="min-w-0 flex-1 text-sm text-[#F0F4F8]">
          <span className="font-medium">{value.number}</span>
          {value.machineName && <span className="text-[#B8C7DB]"> · {value.machineName}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[#8BA3BF] hover:text-[#F0F4F8]"
          aria-label={t('common.staffRequests.recordPicker.change')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#8BA3BF]">{t('common.staffRequests.recordPicker.hint')}</p>
      <div className="flex gap-2">
        {(['all', 'work_order', 'breakdown'] as TypeFilter[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              type === k ? 'bg-[#1A56DB] text-white' : 'bg-[#142849] text-[#B8C7DB] hover:bg-[#1E3A5F]'
            }`}
          >
            {t(`common.staffRequests.recordPicker.types.${k}`)}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA3BF]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.staffRequests.recordPicker.search')}
          className={`${field} pl-9`}
        />
      </div>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-[#1E3A5F]">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1A56DB] border-t-transparent" />
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-center text-xs text-[#F87171]">{t('common.staffRequests.recordPicker.error')}</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#8BA3BF]">
            {records.length === 0 ? t('common.staffRequests.recordPicker.none') : t('common.staffRequests.recordPicker.noMatches')}
          </p>
        ) : (
          <ul className="divide-y divide-[#1E3A5F]">
            {visible.slice(0, MAX_SHOWN).map((r) => {
              const I = Icon(r);
              return (
                <li key={`${r.type}:${r.id}`}>
                  <button
                    type="button"
                    onClick={() => onChange(r)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#142849]"
                  >
                    <I className="h-4 w-4 shrink-0 text-[#5B8DEF]" />
                    <div className="min-w-0 flex-1 truncate text-sm text-[#F0F4F8]">
                      <span className="font-medium">{r.number}</span>
                      {r.machineName && <span className="text-[#B8C7DB]"> · {r.machineName}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {visible.length > MAX_SHOWN && (
        <p className="text-xs text-[#8BA3BF]">{t('common.staffRequests.recordPicker.refine', { count: MAX_SHOWN })}</p>
      )}
    </div>
  );
}
