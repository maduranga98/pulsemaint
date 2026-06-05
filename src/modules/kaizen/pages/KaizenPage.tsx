import { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List,
  BarChart2,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useKaizenList } from '../hooks/useKaizen';
import { KaizenBoard } from '../components/KaizenBoard';
import { KaizenListView } from '../components/KaizenListView';
import { KaizenStats } from '../components/KaizenStats';
import { KaizenMonthlyDigest } from '../components/KaizenMonthlyDigest';
import { KaizenForm } from '../components/KaizenForm';
import type { KaizenCategory, KaizenPriority } from '../types/kaizen.types';
import { KAIZEN_CATEGORY_META, KAIZEN_PRIORITY_META } from '../types/kaizen.types';

type ViewMode = 'board' | 'list' | 'stats' | 'digest';

export function KaizenPage() {
  const role = useAuthStore((s) => s.userProfile?.role ?? 'technician');
  const plan = useAuthStore((s) => s.company?.plan);
  const isProPlan = plan === 'enterprise';
  const canReview = role === 'admin' || role === 'supervisor' || role === 'plant_manager';

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [showStats, setShowStats] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<KaizenCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<KaizenPriority | ''>('');
  const [myKaizens, setMyKaizens] = useState(false);

  // Badge: count of RAISED cards awaiting review
  const { cards: allCards } = useKaizenList({});
  const pendingReviewCount = useMemo(
    () => allCards.filter((c) => c.status === 'RAISED').length,
    [allCards]
  );

  const boardFilters = {
    search: search || undefined,
    category: categoryFilter || undefined,
    priority: priorityFilter || undefined,
    myKaizens: myKaizens || undefined,
  };

  const CATEGORIES = Object.keys(KAIZEN_CATEGORY_META) as KaizenCategory[];
  const PRIORITIES = Object.keys(KAIZEN_PRIORITY_META) as KaizenPriority[];

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-100">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Kaizen Board</h1>
            {canReview && pendingReviewCount > 0 && (
              <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                <Bell size={11} />
                {pendingReviewCount} awaiting review
              </span>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { mode: 'board' as ViewMode, icon: <LayoutGrid size={14} />, label: 'Board' },
              { mode: 'list' as ViewMode, icon: <List size={14} />, label: 'List' },
              { mode: 'stats' as ViewMode, icon: <BarChart2 size={14} />, label: 'Stats' },
              ...(isProPlan
                ? [{ mode: 'digest' as ViewMode, icon: <BarChart2 size={14} />, label: 'Digest' }]
                : []),
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search + filter row */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Kaizens..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1.5 transition-colors ${
              categoryFilter || priorityFilter || myKaizens
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} />
            Filters
            {(categoryFilter || priorityFilter || myKaizens) && (
              <span className="bg-blue-600 text-white rounded-full px-1 text-xs ml-0.5">
                {[categoryFilter, priorityFilter, myKaizens].filter(Boolean).length}
              </span>
            )}
          </button>

          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={myKaizens}
              onChange={(e) => setMyKaizens(e.target.checked)}
              className="rounded text-blue-600"
            />
            My Kaizens
          </label>

          {viewMode === 'board' && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-auto"
            >
              {showStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showStats ? 'Hide' : 'Show'} Stats
            </button>
          )}
        </div>

        {/* Filter chips */}
        {showFilters && (
          <div className="mt-2.5 flex flex-wrap gap-3">
            {/* Category chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">Category:</span>
              <button
                onClick={() => setCategoryFilter('')}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  categoryFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    categoryFilter === cat ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {KAIZEN_CATEGORY_META[cat].icon} {KAIZEN_CATEGORY_META[cat].label}
                </button>
              ))}
            </div>
            {/* Priority chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">Priority:</span>
              <button
                onClick={() => setPriorityFilter('')}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  priorityFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                All
              </button>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)}
                  className={`text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors`}
                  style={{
                    color: priorityFilter === p ? 'white' : KAIZEN_PRIORITY_META[p].color,
                    backgroundColor:
                      priorityFilter === p
                        ? KAIZEN_PRIORITY_META[p].color
                        : KAIZEN_PRIORITY_META[p].bgColor,
                    borderColor: KAIZEN_PRIORITY_META[p].color,
                  }}
                >
                  {KAIZEN_PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats panel (collapsible) */}
      {showStats && viewMode === 'board' && (
        <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0 overflow-y-auto max-h-[50vh]">
          <KaizenStats isProPlan={isProPlan} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'board' && (
          <div className="h-full overflow-x-auto overflow-y-hidden px-4 sm:px-6 py-4">
            <KaizenBoard filters={boardFilters} isProPlan={isProPlan} />
          </div>
        )}

        {viewMode === 'list' && (
          <div className="h-full overflow-hidden bg-white">
            <KaizenListView isProPlan={isProPlan} />
          </div>
        )}

        {viewMode === 'stats' && (
          <div className="h-full overflow-y-auto px-4 sm:px-6 py-4">
            <KaizenStats isProPlan={isProPlan} />
          </div>
        )}

        {viewMode === 'digest' && (
          <div className="h-full overflow-y-auto px-4 sm:px-6 py-4">
            <KaizenMonthlyDigest isProPlan={isProPlan} />
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center z-40 transition-transform hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #1A56DB, #00C2FF)' }}
        title="New Kaizen"
      >
        <Plus size={24} />
      </button>

      {/* Form modal */}
      {showForm && (
        <KaizenForm onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
