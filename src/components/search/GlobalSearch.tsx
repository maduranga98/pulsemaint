import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '../../hooks/useGlobalSearch';

const GROUP_ICON: Record<string, string> = {
  machines: '⚙️',
  workOrders: '🔧',
  breakdowns: '🚨',
  parts: '📦',
  contractors: '👷',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [queryStr, setQueryStr] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { groups, loading } = useGlobalSearch(open ? queryStr : '');

  // Flattened result list for keyboard navigation.
  const flat: SearchResult[] = useMemo(() => groups.flatMap((g) => g.results), [groups]);

  // Global Cmd/Ctrl-K listener.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQueryStr('');
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [queryStr]);

  const go = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      navigate(result.to);
    },
    [navigate],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]);
    }
  };

  return (
    <>
      {/* Topbar trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#142849] border border-[#1E3A5F] text-[#8BA3BF] hover:text-[#F0F4F8] hover:border-[#2E5A8F] transition-colors text-[12px]"
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Search…</span>
        <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[#0F1E35] border border-[#1E3A5F]">
          ⌘K
        </kbd>
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[12vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                value={queryStr}
                onChange={(e) => setQueryStr(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search machines, work orders, breakdowns, parts, contractors…"
                className="flex-1 py-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {queryStr.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  Type at least 2 characters to search.
                </p>
              ) : loading ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Searching…</p>
              ) : groups.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  No results for “{queryStr.trim()}”.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className="py-1">
                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {GROUP_ICON[group.key]} {group.label}
                    </p>
                    {group.results.map((r) => {
                      const idx = flat.indexOf(r);
                      const active = idx === activeIndex;
                      return (
                        <button
                          key={`${group.key}-${r.id}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => go(r)}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 ${
                            active ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                            {r.subtitle && (
                              <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-3">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
