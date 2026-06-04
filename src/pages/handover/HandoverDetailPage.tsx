import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { fetchHandoverById } from '@/services/handover.service';
import type { ShiftHandover } from '@/types/handover.types';
import HandoverDetailView from '@/components/handover/HandoverDetailView';

export function HandoverDetailPage() {
  const { id } = useParams();
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [handover, setHandover] = useState<ShiftHandover | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id && companyId) void fetchHandoverById(companyId, id).then(setHandover);
  }, [companyId, id]);

  const handleExportPdf = () => {
    if (!printRef.current || !handover) return;

    // Clone every <link rel="stylesheet"> and <style> in the document so the
    // print window inherits Tailwind / app styles.
    const styleNodes = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style'),
    )
      .map((node) => node.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      window.print();
      return;
    }

    const title = `${handover.shiftName} Handover — ${handover.shiftDate}`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
${styleNodes}
<style>
  @page { size: A4; margin: 16mm; }
  html, body { background: #fff !important; color: #0f172a; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 0; margin: 0; }
  .print-root { padding: 0; max-width: 100%; }
  /* Hide any element that opts out of print */
  .print\\:hidden, [data-no-print] { display: none !important; }
</style>
</head>
<body>
  <div class="print-root">${printRef.current.innerHTML}</div>
</body>
</html>`);
    printWindow.document.close();

    // Give the new window a beat to apply styles before printing.
    const triggerPrint = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 250);
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 250);
    }
  };

  if (!handover) return <div className="p-6 text-slate-500">Loading handover...</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex justify-end print:hidden">
        <button type="button" onClick={handleExportPdf} className="min-h-12 rounded-md bg-blue-600 px-4 text-sm font-bold text-white">Export PDF</button>
      </div>
      <div ref={printRef}>
        <HandoverDetailView handover={handover} />
      </div>
    </div>
  );
}

export default HandoverDetailPage;
