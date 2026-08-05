import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ClipboardList, Lock, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ContentBuilder } from './components/builder/ContentBuilder';
import { ContactBuilder } from './components/builder/ContactBuilder';
import { AssessmentBuilder } from './components/builder/AssessmentBuilder';

type Tab = 'content' | 'contacts' | 'assessments';

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'content', label: 'Content & Categories', icon: BookOpen },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'assessments', label: 'Assessments', icon: ClipboardList },
];

export const BUILDER_ROLES = ['supervisor', 'plant_manager', 'admin', 'hr_officer', 'safety_officer'] as const;

interface Props {
  /** Provided when rendered inline inside the Triage page's "Create" overlay
   *  — shows a "Back to Triage" button that closes the overlay instead of
   *  navigating. Omitted when reached directly via the /app/triage-builder
   *  route, which falls back to navigating to /app/triage. */
  onBack?: () => void;
}

export default function TriageBuilderPage({ onBack }: Props) {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [activeTab, setActiveTab] = useState<Tab>('content');
  const handleBack = onBack ?? (() => navigate('/app/triage'));

  if (!userProfile?.role || !(BUILDER_ROLES as readonly string[]).includes(userProfile.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Lock className="w-10 h-10 mx-auto mb-4" style={{ color: '#6b7fa3' }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#e2e8f0' }}>
            Access Restricted
          </h2>
          <p className="text-sm" style={{ color: '#6b7fa3' }}>
            The Triage Builder is available to Supervisors, Plant Managers, HR Officers, Safety Officers, and Admins only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors"
        style={{ color: '#6b7fa3' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Triage
      </button>

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
            <tab.icon className="w-4 h-4" />
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
