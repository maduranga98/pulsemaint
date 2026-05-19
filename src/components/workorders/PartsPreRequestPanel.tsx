import { useState } from 'react';
import type { PartsRequest } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';

// Stub — replace with real parts catalog from Module 6
interface PartCatalogItem {
  id: string;
  partName: string;
  partNumber: string;
  unit: string;
  currentStock: number;
  category: string;
}

interface PartsPreRequestPanelProps {
  requests: Omit<PartsRequest, 'id' | 'requestedBy' | 'requestedByName' | 'requestedAt' | 'status' | 'approvedBy' | 'approvedAt' | 'rejectedReason' | 'issuedBy' | 'issuedAt'>[];
  onChange: (requests: PartsPreRequestPanelProps['requests']) => void;
  catalogItems?: PartCatalogItem[];
  readOnly?: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  issued:   'bg-blue-100 text-blue-700',
  returned: 'bg-gray-100 text-gray-600',
};

export function PartsPreRequestPanel({
  requests,
  onChange,
  catalogItems = [],
  readOnly = false,
}: PartsPreRequestPanelProps) {
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartCatalogItem | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const suggestions = catalogItems.filter(
    (p) =>
      search.length >= 2 &&
      (p.partName.toLowerCase().includes(search.toLowerCase()) ||
        p.partNumber.toLowerCase().includes(search.toLowerCase())),
  );

  function selectPart(part: PartCatalogItem) {
    setSelectedPart(part);
    setSearch(part.partName);
    setShowSuggestions(false);
  }

  function addRequest() {
    if (!selectedPart) return;
    onChange([
      ...requests,
      {
        partId: selectedPart.id,
        partName: selectedPart.partName,
        partNumber: selectedPart.partNumber,
        quantity: qty,
        unit: selectedPart.unit,
        currentStock: selectedPart.currentStock,
        note: note || null,
      },
    ]);
    setSearch('');
    setSelectedPart(null);
    setQty(1);
    setNote('');
  }

  function removeRequest(index: number) {
    onChange(requests.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          {/* Part search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {WO_COPY.partsRequestLabel}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); setSelectedPart(null); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={WO_COPY.partSearchPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onMouseDown={() => selectPart(part)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{part.partName}</span>
                      <span
                        className={`text-xs font-semibold ${
                          part.currentStock > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {WO_COPY.currentStockLabel}: {part.currentStock} {part.unit}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {part.partNumber} · {part.category}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPart && (
            <div className="flex items-end gap-3">
              <div className="w-24">
                <label className="block text-xs text-gray-500 mb-1">{WO_COPY.quantityLabel}</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{WO_COPY.noteLabel}</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={addRequest}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                {WO_COPY.addPartButton}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Request list */}
      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 py-3 text-center">{WO_COPY.noParts}</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{req.partName}</p>
                <p className="text-xs text-gray-400">
                  {req.partNumber} · {req.quantity} {req.unit}
                  {req.note && ` · ${req.note}`}
                </p>
                {req.currentStock !== undefined && (
                  <p className={`text-xs font-semibold mt-0.5 ${
                    req.currentStock > 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    Stock: {req.currentStock} {req.unit}
                  </p>
                )}
              </div>
              {'status' in req && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[(req as PartsRequest).status] ?? ''}`}>
                  {(req as PartsRequest).status}
                </span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeRequest(i)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
