import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useComplianceData } from '@/hooks/training/useComplianceData';
import { toast } from 'sonner';
import { downloadComplianceReportPdf } from '@/lib/training/complianceReportPdf';
import { useAuthStore } from '@/store/authStore';
import ComplianceReport from '@/components/training/manager/ComplianceReport';

export default function ComplianceReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const companyName = useAuthStore((s) => s.company?.name ?? null);
  const [isExporting, setIsExporting] = useState(false);
  const { stats, matrixRows, moduleHeaders, loading, error } = useComplianceData();

  // Built in the browser from the matrix on screen (already scoped to the
  // viewer's plant) — the previous Cloud Function only queued a record and
  // never produced a file.
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadComplianceReportPdf({ stats, matrixRows, moduleHeaders, companyName, t });
    } catch (err) {
      console.error('Compliance PDF export failed', err);
      toast.error(t('common.trainingShared.manager.complianceReport.exportFailed', 'Could not create the PDF. Please try again.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label={t('common.trainingShared.manager.complianceReport.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm">{t('common.trainingShared.manager.complianceReport.title')}</h1>
      </div>
      <div>
        <ComplianceReport
          stats={stats}
          matrixRows={matrixRows}
          moduleHeaders={moduleHeaders}
          loading={loading || isExporting}
          error={error}
          onExport={() => void handleExport()}
        />
      </div>
    </div>
  );
}
