import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import type { TriageFlow, TriageStep } from '../../../types/triage';
import TriageFlowSettings from './TriageFlowSettings';
import TriageStepList from './TriageStepList';
import TriageStepEditor from './TriageStepEditor';
import TriageStepPreview from './TriageStepPreview';

interface Props {
  initial?: Partial<TriageFlow>;
  flowId?: string;
}

export default function TriageFlowEditor({ initial, flowId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuthStore();

  const [flow, setFlow] = useState<Partial<TriageFlow>>({
    name: '',
    description: '',
    language: 'en',
    isActive: true,
    steps: [],
    emergencyContacts: [],
    machineShutdownProcedure: '',
    ...initial,
  });

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'steps' | 'preview'>('settings');
  const [saving, setSaving] = useState(false);

  const steps = flow.steps ?? [];
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  const patchFlow = (patch: Partial<TriageFlow>) => setFlow((prev) => ({ ...prev, ...patch }));

  const patchStep = (patch: Partial<TriageStep>) => {
    setFlow((prev) => ({
      ...prev,
      steps: (prev.steps ?? []).map((s) =>
        s.id === selectedStepId ? { ...s, ...patch } : s
      ),
    }));
  };

  const handleSave = async () => {
    if (!userProfile?.companyId) return;
    setSaving(true);
    try {
      const now = Timestamp.now();
      const data = {
        ...flow,
        companyId: userProfile.companyId,
        updatedAt: now,
        updatedBy: userProfile.id ?? '',
        totalEstimatedMinutes: Math.ceil(
          ((flow.steps ?? []).reduce((acc, s) => acc + s.estimatedSeconds, 0)) / 60
        ),
        usageCount: flow.usageCount ?? 0,
        lastUsedAt: flow.lastUsedAt ?? null,
        machineTypeId: flow.machineTypeId ?? null,
        specificMachineId: flow.specificMachineId ?? null,
        isTemplate: flow.isTemplate ?? false,
      };
      if (flowId) {
        await updateDoc(doc(db, 'triageFlows', flowId), data);
      } else {
        const ref = await addDoc(collection(db, 'triageFlows'), {
          ...data,
          createdAt: now,
          createdBy: userProfile.id ?? '',
        });
        navigate(`/app/triage-builder/${ref.id}`);
        return;
      }
      navigate(`/app/triage-builder/${flowId}`);
    } catch (err) {
      console.error('TriageFlowEditor save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const allStepIds = steps.map((s) => s.id);

  const desktopView = (
    <div className="hidden lg:flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel: settings */}
      <div className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto">
        <TriageFlowSettings flow={flow} onChange={patchFlow} />
      </div>
      {/* Center: step list */}
      <div className="w-72 shrink-0 border-r border-gray-200 p-4 overflow-y-auto">
        <TriageStepList
          steps={steps}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onStepsChange={(newSteps) => patchFlow({ steps: newSteps })}
        />
      </div>
      {/* Right: step editor */}
      <div className="flex-1 border-r border-gray-200 overflow-y-auto">
        {selectedStep ? (
          <TriageStepEditor
            step={selectedStep}
            allStepIds={allStepIds}
            onChange={patchStep}
            onSave={handleSave}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a step to edit
          </div>
        )}
      </div>
      {/* Preview */}
      <div className="w-96 shrink-0 bg-gray-100 p-4 overflow-y-auto flex flex-col items-center">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Preview</p>
        <TriageStepPreview step={selectedStep} />
      </div>
    </div>
  );

  const mobileView = (
    <div className="lg:hidden">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {(['settings', 'steps', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              activeTab === tab ? 'border-b-2 border-[#1A56DB] text-[#1A56DB]' : 'text-gray-500'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="p-4 overflow-y-auto">
        {activeTab === 'settings' && (
          <TriageFlowSettings flow={flow} onChange={patchFlow} />
        )}
        {activeTab === 'steps' && (
          <>
            <TriageStepList
              steps={steps}
              selectedStepId={selectedStepId}
              onSelectStep={(id) => { setSelectedStepId(id); setActiveTab('preview'); }}
              onStepsChange={(newSteps) => patchFlow({ steps: newSteps })}
            />
            {selectedStep && (
              <div className="mt-4">
                <TriageStepEditor
                  step={selectedStep}
                  allStepIds={allStepIds}
                  onChange={patchStep}
                  onSave={handleSave}
                />
              </div>
            )}
          </>
        )}
        {activeTab === 'preview' && (
          <div className="flex justify-center">
            <TriageStepPreview step={selectedStep} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top save bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-[#0A1628] font-['Sora']">
          {flowId ? 'Edit Flow' : 'New Triage Flow'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving || !flow.name}
          className="px-5 py-2 bg-[#1A56DB] text-white font-medium rounded-lg text-sm disabled:opacity-40 hover:bg-blue-700"
        >
          {saving ? t('triage.loading') : t('triage.save')}
        </button>
      </div>
      {desktopView}
      {mobileView}
    </div>
  );
}
