import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { TriageFlow } from '../../../types/triage';

interface Props {
  flow: TriageFlow;
  onToggleActive?: (flowId: string, isActive: boolean) => void;
}

export default function TriageFlowCard({ flow, onToggleActive }: Props) {
  const { t } = useTranslation();
  const lastUsed = flow.lastUsedAt
    ? new Date(flow.lastUsedAt.seconds * 1000).toLocaleDateString()
    : '—';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#0A1628] text-[16px] truncate">{flow.name}</h3>
          {flow.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{flow.description}</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={flow.isActive}
          onClick={() => onToggleActive?.(flow.id, !flow.isActive)}
          className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            flow.isActive
              ? 'border-emerald-300 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              flow.isActive ? 'bg-white' : 'bg-gray-400'
            }`}
          />
          {flow.isActive ? t('triage.active') : t('triage.inactive')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
        <span>{flow.steps.length} steps</span>
        <span>·</span>
        <span className="uppercase">{flow.language}</span>
        <span>·</span>
        <span>Used {flow.usageCount}×</span>
        <span>·</span>
        <span>Last: {lastUsed}</span>
      </div>

      <div className="flex gap-2 mt-3">
        <Link
          to={`/app/triage-builder/${flow.id}`}
          className="text-sm font-medium text-[#1A56DB] hover:underline"
        >
          {t('triage.view_report')}
        </Link>
        <span className="text-gray-300">|</span>
        <Link
          to={`/app/triage-builder/${flow.id}/edit`}
          className="text-sm font-medium text-gray-600 hover:underline"
        >
          {t('triage.edit')}
        </Link>
      </div>
    </div>
  );
}
