import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

export default function ReportSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA3BF]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('common.reports.searchBar.placeholder')}
        className="h-12 w-full rounded-lg border border-[#1E3A5F] bg-[#0F1E35] pl-10 pr-3 text-sm text-[#F0F4F8] outline-none transition focus:border-[#00C2FF]"
      />
    </label>
  );
}
