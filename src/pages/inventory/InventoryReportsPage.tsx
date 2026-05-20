import { useState } from 'react';
import { BarChart3, DollarSign, AlertTriangle, Package, X, FileText, Table } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';

interface Report {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  lastGenerated: string | null;
}

const REPORTS: Report[] = [
  {
    id: 'usage',
    icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
    title: 'Inventory Usage Report',
    description: 'Overview of parts usage across work orders and machines for the selected period.',
    lastGenerated: null,
  },
  {
    id: 'cost',
    icon: <DollarSign className="w-6 h-6 text-green-600" />,
    title: 'Maintenance Cost Report',
    description: 'Total cost of parts consumed during maintenance activities, by machine and category.',
    lastGenerated: null,
  },
  {
    id: 'lowstock',
    icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    title: 'Low Stock Alert Report',
    description: 'Parts currently at or below minimum stock levels that require reordering.',
    lastGenerated: null,
  },
  {
    id: 'consumption',
    icon: <Package className="w-6 h-6 text-purple-600" />,
    title: 'Parts Consumption Report',
    description: 'Detailed breakdown of parts issued per work order, technician, and machine.',
    lastGenerated: null,
  },
];

export function InventoryReportsPage() {
  const { addToast } = useToast();
  const canAccess = useAuthStore((s) =>
    s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin'])
  );

  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startMonth: '',
    startYear: new Date().getFullYear().toString(),
    endMonth: '',
    endYear: new Date().getFullYear().toString(),
    machine: '',
    category: '',
  });
  const [generating, setGenerating] = useState(false);

  if (!canAccess) {
    return <Navigate to="/app/inventory" replace />;
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      // Placeholder - no actual PDF generation in phase 1
      await new Promise((r) => setTimeout(r, 1500));
      addToast('Report generated successfully.', 'success');
      setSelectedReport(null);
    } finally {
      setGenerating(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Inventory Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate and export inventory reports.</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                {report.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{report.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>
                {report.lastGenerated && (
                  <p className="text-xs text-gray-400 mt-1">Last generated: {report.lastGenerated}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedReport(report.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate PDF
              </button>
              <button
                onClick={() => {
                  setSelectedReport(report.id);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg transition-colors"
              >
                <Table className="w-3.5 h-3.5" />
                Export Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Filter slide-out panel */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {REPORTS.find((r) => r.id === selectedReport)?.title}
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Start</p>
                    <div className="flex gap-1">
                      <select
                        value={filters.startMonth}
                        onChange={(e) => setFilters((p) => ({ ...p, startMonth: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Month</option>
                        {months.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={filters.startYear}
                        onChange={(e) => setFilters((p) => ({ ...p, startYear: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">End</p>
                    <div className="flex gap-1">
                      <select
                        value={filters.endMonth}
                        onChange={(e) => setFilters((p) => ({ ...p, endMonth: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Month</option>
                        {months.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={filters.endYear}
                        onChange={(e) => setFilters((p) => ({ ...p, endYear: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Machine filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine (optional)</label>
                <input
                  value={filters.machine}
                  onChange={(e) => setFilters((p) => ({ ...p, machine: e.target.value }))}
                  placeholder="All machines"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <input
                  value={filters.category}
                  onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
                  placeholder="All categories"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-60"
              >
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default InventoryReportsPage;
