import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { TriageFlow } from '../../../types/triage';
import TriagePhaseBadge from '../shared/TriagePhaseBadge';
import TriageStepTypeBadge from '../shared/TriageStepTypeBadge';
import TriageSafetyDot from '../shared/TriageSafetyDot';

interface Props {
  flow: TriageFlow;
}

export default function TriageFlowDetail({ flow }: Props) {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link
          to={`/app/triage-builder/${flow.id}/edit`}
          className="px-4 py-2 bg-[#1A56DB] text-white font-medium rounded-lg text-sm hover:bg-blue-700"
        >
          {t('triage.edit')}
        </Link>
        <button className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50">
          {t('triage.duplicate')}
        </button>
        <Link
          to="/app/triage/history"
          className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50"
        >
          {t('triage.view_sessions')}
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h1 className="text-2xl font-bold text-[#0A1628] font-['Sora']">{flow.name}</h1>
        {flow.description && <p className="text-gray-500 text-sm mt-1">{flow.description}</p>}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
          <span>{flow.steps.length} steps</span>
          <span>·</span>
          <span className="uppercase">{flow.language}</span>
          <span>·</span>
          <span>~{flow.totalEstimatedMinutes} min</span>
          <span>·</span>
          <span>Used {flow.usageCount}×</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {flow.steps.map((step) => (
          <div key={step.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 bg-[#0A1628] text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                {step.stepNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-[#0A1628]">{step.title}</span>
                  <TriagePhaseBadge phase={step.phase} />
                  <TriageStepTypeBadge type={step.type} />
                  <TriageSafetyDot level={step.safetyLevel} />
                </div>
                <p className="text-sm text-gray-600">{step.instruction}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
