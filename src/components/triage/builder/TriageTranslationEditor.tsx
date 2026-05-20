import { useState } from 'react';
import type { TriageStepTranslation } from '../../../types/triage';

interface Props {
  translations: Record<string, TriageStepTranslation>;
  onChange: (translations: Record<string, TriageStepTranslation>) => void;
}

const LANGS = [
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
];

export default function TriageTranslationEditor({ translations, onChange }: Props) {
  const [tab, setTab] = useState('si');

  const update = (code: string, field: keyof TriageStepTranslation, value: string) => {
    onChange({
      ...translations,
      [code]: { ...translations[code], [field]: value },
    });
  };

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setTab(l.code)}
            className={`px-3 py-1 text-sm rounded-lg font-medium ${
              tab === l.code
                ? 'bg-[#1A56DB] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Title</label>
          <input
            type="text"
            value={translations[tab]?.title ?? ''}
            onChange={(e) => update(tab, 'title', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Instruction</label>
          <textarea
            value={translations[tab]?.instruction ?? ''}
            onChange={(e) => update(tab, 'instruction', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
          />
        </div>
      </div>
    </div>
  );
}
