import type { TriageStep, TriageStepType } from '../../../types/triage';
import TriageOptionEditor from './TriageOptionEditor';
import TriageChecklistEditor from './TriageChecklistEditor';

interface Props {
  step: TriageStep;
  allStepIds: string[];
  onChange: (patch: Partial<TriageStep>) => void;
}

export default function TriageStepTypeFields({ step, allStepIds, onChange }: Props) {
  const type: TriageStepType = step.type;

  if (type === 'yes_no' || type === 'multiple_choice') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Options</label>
        <TriageOptionEditor
          options={step.options}
          allStepIds={allStepIds}
          onChange={(options) => onChange({ options })}
        />
      </div>
    );
  }

  if (type === 'checklist') {
    return (
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">Checklist Items</label>
        <TriageChecklistEditor
          items={step.checklistItems}
          onChange={(items) => onChange({ checklistItems: items })}
        />
      </div>
    );
  }

  if (type === 'number_input') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Field Label</label>
          <input
            type="text"
            value={step.fieldLabel ?? ''}
            onChange={(e) => onChange({ fieldLabel: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit</label>
            <input
              type="text"
              value={step.unit ?? ''}
              onChange={(e) => onChange({ unit: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Min</label>
            <input
              type="number"
              value={step.normalMin ?? ''}
              onChange={(e) => onChange({ normalMin: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Max</label>
            <input
              type="number"
              value={step.normalMax ?? ''}
              onChange={(e) => onChange({ normalMax: parseFloat(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'text_input') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Placeholder</label>
          <input
            type="text"
            value={step.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Max Characters</label>
          <input
            type="number"
            value={step.maxChars ?? 500}
            onChange={(e) => onChange({ maxChars: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>
      </div>
    );
  }

  return null;
}
