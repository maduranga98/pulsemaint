import { useState } from 'react';
import type { ContentLibraryItem } from '@/lib/training/trainingTypes';
import type { Timestamp } from 'firebase/firestore';
import {
  Video,
  FileText,
  Image,
  Trash2,
  MousePointerClick,
  Loader2,
} from 'lucide-react';

interface ContentLibraryGridProps {
  items: ContentLibraryItem[];
  loading: boolean;
  onDelete: (id: string) => void;
  onSelect?: (item: ContentLibraryItem) => void;
}

type TypeFilter = 'all' | 'video' | 'document' | 'image';

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_ICON: Record<ContentLibraryItem['type'], React.ReactNode> = {
  video: <Video className="w-8 h-8 text-blue-400" />,
  document: <FileText className="w-8 h-8 text-amber-400" />,
  image: <Image className="w-8 h-8 text-green-400" />,
};

const TYPE_BADGE: Record<ContentLibraryItem['type'], string> = {
  video: 'bg-blue-100 text-blue-700',
  document: 'bg-amber-100 text-amber-700',
  image: 'bg-green-100 text-green-700',
};

export default function ContentLibraryGrid({
  items,
  loading,
  onDelete,
  onSelect,
}: ContentLibraryGridProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = items.filter((item) => {
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    const matchSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const filterButtons: { label: string; value: TypeFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Video', value: 'video' },
    { label: 'Document', value: 'document' },
    { label: 'Image', value: 'image' },
  ];

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      onDelete(id);
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setTypeFilter(btn.value)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                typeFilter === btn.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mb-2" />
          <p className="text-sm">No files found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    {TYPE_ICON[item.type]}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex-1 flex flex-col gap-2">
                <p
                  className="text-sm font-medium text-gray-900 truncate"
                  title={item.name}
                >
                  {item.name}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium capitalize ${TYPE_BADGE[item.type]}`}
                  >
                    {item.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatBytes(item.fileSizeBytes)}
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  Used in {item.usedInModules.length} module
                  {item.usedInModules.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {formatTs(item.uploadedAt)}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-1">
                  {onSelect && (
                    <button
                      onClick={() => onSelect(item)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <MousePointerClick className="w-3 h-3" />
                      Select
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    disabled={item.usedInModules.length > 0}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-red-500 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      item.usedInModules.length > 0
                        ? 'Cannot delete — used in modules'
                        : 'Delete'
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Delete File?</h3>
            <p className="text-sm text-gray-600">
              This file will be permanently deleted and cannot be recovered.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
