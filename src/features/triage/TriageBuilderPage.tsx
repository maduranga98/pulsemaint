import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { ContentBuilder } from './components/builder/ContentBuilder';
import { ContactBuilder } from './components/builder/ContactBuilder';
import { AssessmentBuilder } from './components/builder/AssessmentBuilder';

type Tab = 'content' | 'contacts' | 'assessments';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'content', label: 'Content & Categories', icon: '📚' },
  { id: 'contacts', label: 'Contacts', icon: '👥' },
  { id: 'assessments', label: 'Assessments', icon: '📋' },
];

const BUILDER_ROLES = ['supervisor', 'plant_manager', 'admin'] as const;

export default function TriageBuilderPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [activeTab, setActiveTab] = useState<Tab>('content');

  if (!userProfile?.role || !(BUILDER_ROLES as readonly string[]).includes(userProfile.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#e2e8f0' }}>
            Access Restricted
          </h2>
          <p className="text-sm" style={{ color: '#6b7fa3' }}>
            The Triage Builder is available to Supervisors, Plant Managers, and Admins only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>
          Triage Builder
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
          Create and manage triage content, contacts, and assessments
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ background: '#111d2e', border: '1px solid #1a2840' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === tab.id ? '#1d4ed8' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7fa3',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'content' && <ContentBuilder />}
      {activeTab === 'contacts' && <ContactBuilder />}
      {activeTab === 'assessments' && <AssessmentBuilder />}
    </div>
  );
}
