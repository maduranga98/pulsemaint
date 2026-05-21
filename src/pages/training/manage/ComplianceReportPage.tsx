import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useComplianceData } from '@/hooks/training/useComplianceData';
import { generateComplianceReportPdf } from '@/lib/training/certificateGenerator';
import { useAuthStore } from '@/store/authStore';
import ComplianceReport from '@/components/training/manager/ComplianceReport';

export default function ComplianceReportPage() {
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [isExporting, setIsExporting] = useState(false);
  const { stats, matrixRows, moduleHeaders, loading } = useComplianceData();

  const handleExport = async () => {
    if (!companyId) return;
    setIsExporting(true);
    try {
      await generateComplianceReportPdf(companyId, {});
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
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm">Compliance Report</h1>
      </div>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <ComplianceReport
          stats={stats}
          matrixRows={matrixRows}
          moduleHeaders={moduleHeaders}
          loading={loading || isExporting}
          onExport={() => void handleExport()}
        />
      </div>
    </div>
  );
}
