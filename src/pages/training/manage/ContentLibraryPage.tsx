import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useContentLibrary } from '@/hooks/training/useContentLibrary';
import ContentLibraryGrid from '@/components/training/manager/ContentLibraryGrid';
import ContentLibraryUpload from '@/components/training/manager/ContentLibraryUpload';

export default function ContentLibraryPage() {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const { items, loading, deleteItem } = useContentLibrary();

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item from the library? This cannot be undone.')) return;
    const item = items.find((i) => i.id === id);
    await deleteItem(id, item?.url);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm flex-1">Content Library</h1>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {showUpload ? 'Hide Upload' : '+ Upload'}
        </button>
      </div>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {showUpload && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ContentLibraryUpload onUploadComplete={() => setShowUpload(false)} />
          </div>
        )}
        <ContentLibraryGrid items={items} loading={loading} onDelete={handleDelete} />
      </div>
    </div>
  );
}
