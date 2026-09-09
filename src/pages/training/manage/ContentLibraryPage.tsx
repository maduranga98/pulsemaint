import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useContentLibrary } from '@/hooks/training/useContentLibrary';
import ContentLibraryGrid from '@/components/training/manager/ContentLibraryGrid';
import ContentLibraryUpload from '@/components/training/manager/ContentLibraryUpload';

export default function ContentLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const { items, loading, deleteItem } = useContentLibrary();
  // Matches the firestore.rules delete rule for trainingContentLibrary — admin only.
  const canDelete = useAuthStore((s) => s.isAdmin);

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.trainingShared.manager.contentLibrary.deleteConfirm'))) return;
    const item = items.find((i) => i.id === id);
    await deleteItem(id, item?.url);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label={t('common.trainingShared.manager.contentLibrary.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm flex-1">{t('common.trainingShared.manager.contentLibrary.title')}</h1>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {showUpload ? t('common.trainingShared.manager.contentLibrary.hideUpload') : t('common.trainingShared.manager.contentLibrary.uploadButton')}
        </button>
      </div>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {showUpload && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ContentLibraryUpload onUploadComplete={() => setShowUpload(false)} />
          </div>
        )}
        <ContentLibraryGrid items={items} loading={loading} onDelete={canDelete ? handleDelete : undefined} />
      </div>
    </div>
  );
}
