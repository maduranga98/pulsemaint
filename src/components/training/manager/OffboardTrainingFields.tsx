import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { OffboardTrainingDetails, OffboardTrainingMode } from '@/lib/training/trainingTypes';
import {
  DEFAULT_OFFBOARD_QUESTIONS,
  OFFBOARD_COUNTRIES,
  computeDurationDays,
} from '@/lib/training/offboardTraining';

export interface OffboardFormValues {
  country: string;
  thirdPartyCompany: string;
  thirdPartyContactName: string;
  thirdPartyContactInfo: string;
  mode: OffboardTrainingMode;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  topic: string;
  linkedMachineId: string;
  assessmentQuestions: string[];
}

interface OffboardTrainingFieldsProps {
  value: OffboardFormValues;
  onChange: (value: OffboardFormValues) => void;
}

export function offboardDetailsToFormValues(
  details: OffboardTrainingDetails | null | undefined
): OffboardFormValues {
  const toDateInput = (d: unknown): string => {
    if (!d) return '';
    const date = (d as { toDate?: () => Date }).toDate
      ? (d as { toDate: () => Date }).toDate()
      : new Date(d as string);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };
  return {
    country: details?.country ?? '',
    thirdPartyCompany: details?.thirdPartyCompany ?? '',
    thirdPartyContactName: details?.thirdPartyContactName ?? '',
    thirdPartyContactInfo: details?.thirdPartyContactInfo ?? '',
    mode: details?.mode ?? 'in-person',
    startDate: toDateInput(details?.startDate),
    endDate: toDateInput(details?.endDate),
    topic: details?.topic ?? '',
    linkedMachineId: details?.linkedMachineId ?? '',
    assessmentQuestions:
      details?.assessmentQuestions && details.assessmentQuestions.length > 0
        ? details.assessmentQuestions
        : [...DEFAULT_OFFBOARD_QUESTIONS],
  };
}

export function defaultOffboardFormValues(): OffboardFormValues {
  return {
    country: '',
    thirdPartyCompany: '',
    thirdPartyContactName: '',
    thirdPartyContactInfo: '',
    mode: 'in-person',
    startDate: '',
    endDate: '',
    topic: '',
    linkedMachineId: '',
    assessmentQuestions: [...DEFAULT_OFFBOARD_QUESTIONS],
  };
}

export default function OffboardTrainingFields({ value, onChange }: OffboardTrainingFieldsProps) {
  const [customQuestion, setCustomQuestion] = useState('');
  const durationDays = computeDurationDays(value.startDate || null, value.endDate || null);

  function update<K extends keyof OffboardFormValues>(key: K, val: OffboardFormValues[K]) {
    onChange({ ...value, [key]: val });
  }

  function toggleQuestion(question: string) {
    const has = value.assessmentQuestions.includes(question);
    update(
      'assessmentQuestions',
      has
        ? value.assessmentQuestions.filter((q) => q !== question)
        : [...value.assessmentQuestions, question]
    );
  }

  function addCustomQuestion() {
    const q = customQuestion.trim();
    if (!q || value.assessmentQuestions.includes(q)) return;
    update('assessmentQuestions', [...value.assessmentQuestions, q]);
    setCustomQuestion('');
  }

  function removeQuestion(question: string) {
    update(
      'assessmentQuestions',
      value.assessmentQuestions.filter((q) => q !== question)
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Offboard / External Training Details
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={value.country}
            onChange={(e) => update('country', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select country…</option>
            {OFFBOARD_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Third-Party Company <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.thirdPartyCompany}
            onChange={(e) => update('thirdPartyCompany', e.target.value)}
            placeholder="e.g. Siemens Training Center"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Contact Name</label>
          <input
            type="text"
            value={value.thirdPartyContactName}
            onChange={(e) => update('thirdPartyContactName', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Contact Info</label>
          <input
            type="text"
            value={value.thirdPartyContactInfo}
            onChange={(e) => update('thirdPartyContactInfo', e.target.value)}
            placeholder="email / phone"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Mode</label>
        <div className="flex gap-4">
          {(['in-person', 'online', 'hybrid'] as OffboardTrainingMode[]).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                name="offboard-mode"
                checked={value.mode === m}
                onChange={() => update('mode', m)}
              />
              {m === 'in-person' ? 'In-person' : m === 'online' ? 'Online' : 'Hybrid'}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {durationDays > 0 && (
        <p className="text-xs text-gray-500 -mt-3">
          Duration: <strong>{durationDays} day{durationDays !== 1 ? 's' : ''}</strong>
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={value.topic}
          onChange={(e) => update('topic', e.target.value)}
          placeholder="e.g. Advanced PLC Programming"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col gap-2">
        <span className="text-sm font-semibold text-gray-700">Assessment Questions</span>
        <p className="text-xs text-gray-400 mb-1">
          Trainee will answer these after completing the training.
        </p>
        {DEFAULT_OFFBOARD_QUESTIONS.map((q) => (
          <label key={q} className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={value.assessmentQuestions.includes(q)}
              onChange={() => toggleQuestion(q)}
            />
            <span>{q}</span>
          </label>
        ))}

        {value.assessmentQuestions
          .filter((q) => !DEFAULT_OFFBOARD_QUESTIONS.includes(q))
          .map((q) => (
            <div key={q} className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1">
              <span className="flex-1">{q}</span>
              <button type="button" onClick={() => removeQuestion(q)} className="text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ))}

        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Add a custom question…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addCustomQuestion}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg px-2 py-1.5"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
