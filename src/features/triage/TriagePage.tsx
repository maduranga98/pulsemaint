import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { BookOpen, ClipboardCheck, Phone, Plus, type LucideIcon } from 'lucide-react';
import { db } from '../../lib/firebase';
import { COL } from './api';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { TriageCategory } from './types';
import { ensureTriageSeed } from './seed';
import { CategoryRail } from './components/CategoryRail';
import { CategoryGrid } from './components/CategoryGrid';
import { ContentList } from './components/ContentList';
import { ContactList } from './components/ContactList';
import { AssessmentList } from './components/AssessmentList';
import TriageBuilderPage, { BUILDER_ROLES } from './TriageBuilderPage';

type View = 'guides' | 'contacts' | 'quizzes';

const TABS: { id: View; icon: LucideIcon; color: string; label: string; hint: string }[] = [
  { id: 'guides', icon: BookOpen, color: '#3b82f6', label: 'guides', hint: 'guidesHint' },
  { id: 'contacts', icon: Phone, color: '#f97316', label: 'contacts', hint: 'contactsHint' },
  { id: 'quizzes', icon: ClipboardCheck, color: '#fbbf24', label: 'quizzes', hint: 'quizzesHint' },
];

export default function TriagePage() {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = userProfile?.id ?? '';
  const canBuild = !!userProfile?.role && (BUILDER_ROLES as readonly string[]).includes(userProfile.role);
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const [view, setView] = useState<View>('guides');
  const [selected, setSelected] = useState<string | null>(null);
  const [cats, setCats] = useState<TriageCategory[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showBuilder, setShowBuilder] = useState(false);

  // Seed sample categories, content, contacts and assessments on first load
  // so a fresh company never sees empty Triage screens. Idempotent + guarded.
  useEffect(() => {
    if (!companyId || !uid) return;
    void ensureTriageSeed(companyId, uid);
  }, [companyId, uid]);

  useEffect(() => {
    if (!companyId) return;
    // Sorted client-side: companyId + orderBy(pinned, order) needs a
    // composite index. If it isn't deployed the query fails silently and
    // categories show inconsistently (or not at all) depending on the
    // client, so sort in memory instead of relying on the index.
    return onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory));
        list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.order ?? 0) - (b.order ?? 0));
        setCats(list);
      },
    );
  }, [companyId]);

  // One company-wide read to show "Guides: N" on every topic.
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      query(collection(db, COL.content), where('companyId', '==', companyId)),
      (snap) => {
        const next: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const id = (d.data() as { categoryId?: string }).categoryId;
          if (id) next[id] = (next[id] ?? 0) + 1;
        });
        setCounts(next);
      },
    );
  }, [companyId]);

  // Desktop always has a topic open; phones start on the topic picker.
  const activeId = selected ?? (isDesktop ? cats[0]?.id ?? null : null);
  const selectedCat = useMemo(() => cats.find((c) => c.id === activeId) ?? null, [cats, activeId]);

  function renderGuides() {
    if (isDesktop) {
      return (
        <div className="flex gap-5" style={{ minHeight: 480 }}>
          <CategoryRail cats={cats} counts={counts} selected={activeId} onSelect={setSelected} />
          <div className="flex-1 min-w-0">
            <div
              className="rounded-2xl p-5 sm:p-6 h-full"
              style={{ background: '#0e1628', border: '1px solid #1a2840' }}
            >
              {selectedCat ? (
                <ContentList category={selectedCat} />
              ) : (
                <div className="flex items-center justify-center h-full text-base" style={{ color: '#6b7fa3' }}>
                  {t('common.triage.knowledge.page.selectCategoryPrompt')}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (!selectedCat) {
      return <CategoryGrid cats={cats} counts={counts} onSelect={setSelected} />;
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 inline-flex items-center gap-1 min-h-[44px] text-base font-semibold"
          style={{ color: '#bfdbfe' }}
        >
          ← {t('common.triage.knowledge.contentList.back')}
        </button>
        <ContentList category={selectedCat} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold" style={{ color: '#e2e8f0' }}>
            {t('common.triage.knowledge.page.title')}
          </h1>
          <p className="text-base mt-1" style={{ color: '#a7b6d3' }}>
            {t('common.triage.knowledge.page.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('contacts')}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl px-5 min-h-[48px] text-base font-bold text-white"
            style={{ background: '#dc2626' }}
          >
            <Phone className="w-5 h-5" /> {t('common.triage.knowledge.page.emergencyButton')}
          </button>
          {canBuild && (
            <button
              type="button"
              onClick={() => setShowBuilder(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 min-h-[48px] text-sm font-semibold text-white transition-colors"
              style={{ background: '#1d4ed8' }}
            >
              <Plus className="w-4 h-4" /> {t('common.triage.knowledge.page.create')}
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label={t('common.triage.knowledge.page.title')} className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
        {TABS.map(({ id, icon: Icon, color, label, hint }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(id)}
              className="flex items-center justify-center sm:justify-start gap-3 rounded-2xl px-2 sm:px-5 py-3 min-h-[56px] sm:min-h-[72px] text-left transition-colors"
              style={{
                background: active ? '#12203d' : '#0e1628',
                border: `2px solid ${active ? color : '#1f2f4a'}`,
                color: '#e2e8f0',
              }}
            >
              <span
                className="hidden sm:flex w-12 h-12 shrink-0 items-center justify-center rounded-xl"
                style={{ background: color, color: '#0a0f1c' }}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[15px] sm:text-lg font-bold leading-tight text-center sm:text-left">
                  {t(`common.triage.knowledge.page.tabs.${label}`)}
                </span>
                <span className="hidden sm:block text-sm" style={{ color: '#a7b6d3' }}>
                  {t(`common.triage.knowledge.page.tabs.${hint}`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {view === 'guides' && renderGuides()}
      {view === 'contacts' && <ContactList />}
      {view === 'quizzes' && <AssessmentList />}

      {showBuilder && canBuild && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ background: '#0a0f1c' }}
        >
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            <TriageBuilderPage onBack={() => setShowBuilder(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
