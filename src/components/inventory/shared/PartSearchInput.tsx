import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventoryPart } from '@/types/inventory';

interface PartSearchInputProps {
  onSelect: (part: InventoryPart) => void;
  placeholder?: string;
  excludePartIds?: string[];
}

export function PartSearchInput({
  onSelect,
  placeholder = 'Search parts by number or name…',
  excludePartIds = [],
}: PartSearchInputProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<InventoryPart[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (term: string) => {
      if (!companyId || term.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      try {
        const col = collection(db, 'inventoryParts');
        // Search by partNumber prefix
        const byNumber = query(
          col,
          where('companyId', '==', companyId),
          where('partNumber', '>=', term.toUpperCase()),
          where('partNumber', '<=', term.toUpperCase() + ''),
          orderBy('partNumber'),
          limit(10)
        );
        // Search by name prefix
        const byName = query(
          col,
          where('companyId', '==', companyId),
          where('name', '>=', term),
          where('name', '<=', term + ''),
          orderBy('name'),
          limit(10)
        );

        const [numSnap, nameSnap] = await Promise.all([getDocs(byNumber), getDocs(byName)]);
        const seen = new Set<string>();
        const parts: InventoryPart[] = [];

        for (const snap of [numSnap, nameSnap]) {
          snap.forEach((doc) => {
            if (!seen.has(doc.id) && !excludePartIds.includes(doc.id)) {
              seen.add(doc.id);
              parts.push({ id: doc.id, ...doc.data() } as InventoryPart);
            }
          });
        }

        setResults(parts.slice(0, 10));
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [companyId, excludePartIds]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(inputValue);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(part: InventoryPart) {
    onSelect(part);
    setInputValue('');
    setIsOpen(false);
    setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">No parts found</div>
          )}
          {!isLoading &&
            results.map((part) => (
              <button
                key={part.id}
                onClick={() => handleSelect(part)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-blue-700">{part.partNumber}</span>
                  <span className="text-xs text-gray-500">{part.unit}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{part.name}</p>
                {part.brand && (
                  <p className="text-xs text-gray-500">{part.brand}</p>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
