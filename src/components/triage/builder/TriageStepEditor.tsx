import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageStepPhase, TriageStepType, TriageSafetyLevel } from '../../../types/triage';
import TriageStepTypeFields from './TriageStepTypeFields';
import TriageTranslationEditor from './TriageTranslationEditor';

interface Props {
  step: TriageStep;
  allStepIds: string[];
  onChange: (patch: Partial<TriageStep>) => void;
  onSave: () => void;
}

const PHASES: TriageStepPhase[] = ['safety', 'assessment', 'safe_action', 'document', 'wait'];
const TYPES: TriageStepType[] = [
  'statement', 'yes_no', 'multiple_choice', 'photo_required', 'number_input', 'text_input', 'checklist',
];
const SAFETY_LEVELS: TriageSafetyLevel[] = ['safe', 'caution', 'danger'];

export default function TriageStepEditor({ step, allStepIds, onChange, onSave }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <h3 className="font-semibold text-[#0A1628] text-lg font-['Sora']">
        Edit Step #{step.stepNumber}
      </h3>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Title *</label>
        <input
          type="text"
          value={step.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Instruction</label>
        <textarea
          value={step.instruction}
          onChange={(e) => onChange({ instruction: e.target.value })}
          rows={3}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Phase</label>
          <select
            value={step.phase}
            onChange={(e) => onChange({ phase: e.target.value as TriageStepPhase })}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none"
          >
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Type</label>
          <select
            value={step.type}
            onChange={(e) => onChange({ type: e.target.value as TriageStepType })}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none"
          >
            {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">Safety</label>
          <select
            value={step.safetyLevel}
            onChange={(e) => onChange({ safetyLevel: e.target.value as TriageSafetyLevel })}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none"
          >
            {SAFETY_LEVELS.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={step.isEscalationStep}
            onChange={(e) => onChange({ isEscalationStep: e.target.checked })}
            className="accent-red-500"
          />
          Escalation step
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={step.isQuickFixStep}
            onChange={(e) => onChange({ isQuickFixStep: e.target.checked })}
            className="accent-green-500"
          />
          Quick-fix step
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={step.requiresPhoto}
            onChange={(e) => onChange({ requiresPhoto: e.target.checked })}
            className="accent-blue-500"
          />
          Requires photo
        </label>
      </div>

      <TriageStepTypeFields step={step} allStepIds={allStepIds} onChange={onChange} />

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">
          {t('triage.translate_tab')}
        </label>
        <TriageTranslationEditor
          translations={step.translations}
          onChange={(translations) => onChange({ translations })}
        />
      </div>

      <button
        onClick={onSave}
        className="w-full min-h-[44px] bg-[#1A56DB] text-white font-semibold rounded-xl hover:bg-blue-700 mt-2"
      >
        {t('triage.save')}
      </button>
    </div>
  );
}
