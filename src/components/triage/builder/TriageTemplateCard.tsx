import { useTranslation } from 'react-i18next';
import type { TriageFlow, TriageStepPhase } from '../../../types/triage';

interface Props {
  template: TriageFlow;
  onUse?: (template: TriageFlow) => void;
  onPreview?: (template: TriageFlow) => void;
}

export default function TriageTemplateCard({ template, onUse, onPreview }: Props) {
  const { t } = useTranslation();

  const phaseCounts = template.steps.reduce<Partial<Record<TriageStepPhase, number>>>(
    (acc, s) => {
      acc[s.phase] = (acc[s.phase] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#1A56DB]/10 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[#1A56DB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#0A1628]">{template.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          {template.steps.length} {t('triage.steps_tab')}
        </span>
        {Object.entries(phaseCounts).map(([phase, count]) => (
          <span key={phase} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {phase}: {count}
          </span>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => onPreview?.(template)}
          className="flex-1 min-h-[40px] border-2 border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          {t('triage.preview')}
        </button>
        <button
          onClick={() => onUse?.(template)}
          className="flex-1 min-h-[40px] bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          {t('triage.use_template')}
        </button>
      </div>
    </div>
  );
}
