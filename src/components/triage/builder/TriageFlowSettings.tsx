import { useTranslation } from 'react-i18next';
import type { TriageFlow, TriageLanguage, TriageEmergencyContact } from '../../../types/triage';

interface Props {
  flow: Partial<TriageFlow>;
  onChange: (patch: Partial<TriageFlow>) => void;
}

const LANGUAGES: { code: TriageLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'si', label: 'Sinhala' },
  { code: 'ta', label: 'Tamil' },
  { code: 'bn', label: 'Bengali' },
];

export default function TriageFlowSettings({ flow, onChange }: Props) {
  const { t } = useTranslation();

  const addContact = () => {
    const contacts = flow.emergencyContacts ?? [];
    onChange({ emergencyContacts: [...contacts, { name: '', phone: '', role: '' }] });
  };

  const updateContact = (index: number, patch: Partial<TriageEmergencyContact>) => {
    const contacts = (flow.emergencyContacts ?? []).map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    onChange({ emergencyContacts: contacts });
  };

  const removeContact = (index: number) => {
    onChange({ emergencyContacts: (flow.emergencyContacts ?? []).filter((_, i) => i !== index) });
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <h3 className="font-semibold text-[#0A1628] text-lg font-['Sora']">Flow Settings</h3>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">{t('triage.flow_name')} *</label>
        <input
          type="text"
          value={flow.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">{t('triage.description')}</label>
        <textarea
          value={flow.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">{t('triage.language')}</label>
        <select
          value={flow.language ?? 'en'}
          onChange={(e) => onChange({ language: e.target.value as TriageLanguage })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block">{t('triage.shutdown_procedure')}</label>
        <textarea
          value={flow.machineShutdownProcedure ?? ''}
          onChange={(e) => onChange({ machineShutdownProcedure: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600">{t('triage.emergency_contacts')}</label>
          <button onClick={addContact} className="text-xs text-[#1A56DB] hover:underline">+ Add</button>
        </div>
        <div className="flex flex-col gap-2">
          {(flow.emergencyContacts ?? []).map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2 bg-gray-50 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => updateContact(i, { name: e.target.value })}
                  placeholder="Name"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
                />
                <input
                  type="text"
                  value={c.role}
                  onChange={(e) => updateContact(i, { role: e.target.value })}
                  placeholder="Role"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
                />
                <button onClick={() => removeContact(i)} className="text-red-400 hover:text-red-600">×</button>
              </div>
              <input
                type="tel"
                value={c.phone}
                onChange={(e) => updateContact(i, { phone: e.target.value })}
                placeholder="Phone"
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Active</label>
        <button
          onClick={() => onChange({ isActive: !flow.isActive })}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            flow.isActive ? 'bg-[#10B981]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              flow.isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
