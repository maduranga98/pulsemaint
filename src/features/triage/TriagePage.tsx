import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COL } from './api';
import { useAuthStore } from '../../store/authStore';
import type { TriageCategory } from './types';
import { ensureTriageSeed } from './seed';
import { DashboardMetrics } from './components/DashboardMetrics';
import { CategoryRail, type PanelId } from './components/CategoryRail';
import { ContentList } from './components/ContentList';
import { ContactList } from './components/ContactList';
import { AssessmentList } from './components/AssessmentList';
import { AITriage } from './components/AITriage';

export default function TriagePage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = userProfile?.uid ?? '';

  const [selected, setSelected] = useState<PanelId>('ai');
  const [cats, setCats] = useState<TriageCategory[]>([]);

  // Seed sample categories, content, contacts and assessments on first load
  // so a fresh company never sees empty Triage screens. Idempotent + guarded.
  useEffect(() => {
    if (!companyId || !uid) return;
    void ensureTriageSeed(companyId, uid);
  }, [companyId, uid]);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
        orderBy('pinned', 'desc'),
        orderBy('order', 'asc'),
      ),
      (snap) => {
        setCats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory)));
      },
    );
  }, [companyId]);

  const selectedCat = cats.find((c) => c.id === selected);

  function renderContent() {
    switch (selected) {
      case 'ai':
        return <AITriage />;
      case 'contacts':
        return <ContactList />;
      case 'assessments':
        return <AssessmentList />;
      default:
        return selectedCat ? (
          <ContentList category={selectedCat} />
        ) : (
          <div
            className="flex items-center justify-center h-full text-sm"
            style={{ color: '#3d5070' }}
          >
            Select a category from the left panel
          </div>
        );
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>
          Triage
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
          Procedures, guides, contacts, and AI-assisted troubleshooting
        </p>
      </div>

      <DashboardMetrics />

      <div className="flex gap-5" style={{ minHeight: 600 }}>
        <CategoryRail selected={selected} onSelect={setSelected} />

        <div className="flex-1 min-w-0 overflow-hidden">
          <div
            className="rounded-xl p-5 h-full overflow-y-auto"
            style={{ background: '#0e1628', border: '1px solid #1a2840' }}
          >
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
