import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useMachines } from '../../hooks/useMachines';
import {
  MachineFilterBar,
  MachineCard,
  MachineListTable,
} from '../../components/machines';
import type { MachineFilters, MachineType, MachineStatus, MachineCriticality } from '../../types/machine';
import { generateMachineQrUrl } from '../../lib/machineQr';
import { auth } from '../../lib/firebase';

const VALID_TYPES: MachineType[] = [
  'cnc_machine','conveyor','compressor','boiler','generator','hydraulic_press',
  'pump','motor','crane','lathe','milling_machine','welding_machine','hvac','other',
];
const VALID_STATUSES: MachineStatus[] = ['active','under_maintenance','decommissioned'];

interface CsvRow {
  name: string;
  type: MachineType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  department: string;
  floor: string;
  bay: string;
  station: string;
  status: MachineStatus;
  criticality: MachineCriticality;
  _error?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const get = (key: string) => vals[headers.indexOf(key)] ?? '';
    const type = get('type') as MachineType;
    const status = (get('status') || 'active') as MachineStatus;
    const critRaw = parseInt(get('criticality') || '3', 10);
    const criticality = ([1,2,3,4,5].includes(critRaw) ? critRaw : 3) as MachineCriticality;

    let _error: string | undefined;
    if (!get('name')) _error = 'Missing name';
    else if (!get('manufacturer')) _error = 'Missing manufacturer';
    else if (!VALID_TYPES.includes(type)) _error = `Invalid type "${type}"`;
    else if (!VALID_STATUSES.includes(status)) _error = `Invalid status "${status}"`;

    return {
      name: get('name'),
      type: VALID_TYPES.includes(type) ? type : 'other',
      manufacturer: get('manufacturer'),
      model: get('model'),
      serialNumber: get('serial_number'),
      department: get('department'),
      floor: get('floor'),
      bay: get('bay'),
      station: get('station'),
      status: VALID_STATUSES.includes(status) ? status : 'active',
      criticality,
      _error,
    };
  });
}

function downloadCsvTemplate() {
  const headers = 'name,type,manufacturer,model,serial_number,department,floor,bay,station,status,criticality';
  const example = 'CNC Lathe 01,cnc_machine,Mazak,QUICK TURN 200,SN-001,Production,Ground,A1,01,active,3';
  const blob = new Blob([headers + '\n' + example], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'machine_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface ImportModalProps {
  siteId: string;
  onClose: () => void;
  onDone: () => void;
}

function ImportModal({ siteId, onClose, onDone }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRows(parseCsv(ev.target?.result as string));
    reader.readAsText(file);
  };

  const validRows = rows.filter((r) => !r._error);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    const userId = auth.currentUser?.uid ?? 'unknown';
    let count = 0;
    for (const row of validRows) {
      const ref = doc(collection(db, 'machines'));
      await setDoc(ref, {
        siteId,
        name: row.name,
        type: row.type,
        manufacturer: row.manufacturer,
        model: row.model || null,
        serialNumber: row.serialNumber || null,
        department: row.department || '',
        floor: row.floor || null,
        bay: row.bay || null,
        station: row.station || null,
        status: row.status,
        criticality: row.criticality,
        healthScore: 100,
        purchaseDate: null,
        installationDate: null,
        expectedLifespanYears: null,
        lastServiceDate: null,
        lastServiceType: null,
        lastTechnicians: [],
        nextPmDue: null,
        partsReplaced: [],
        compatiblePartIds: [],
        documents: [],
        photos: [],
        warrantyItems: [],
        modificationNotes: null,
        additionalNotes: null,
        sopLibraryRefs: [],
        qrCode: generateMachineQrUrl(ref.id, siteId),
        oeeData: null,
        iotSensorId: null,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      count++;
      setProgress(`Importing... ${count}/${validRows.length}`);
    }
    setImporting(false);
    setDone(true);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Machines from CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <p className="text-green-600 font-medium text-lg">
                Successfully imported {validRows.length} machine{validRows.length !== 1 ? 's' : ''}!
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadCsvTemplate}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Download CSV Template
                </button>
                <span className="text-sm text-gray-500">then fill it out and upload below</span>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
                <p><strong>Valid types:</strong> {VALID_TYPES.join(', ')}</p>
                <p><strong>Valid statuses:</strong> {VALID_STATUSES.join(', ')}</p>
                <p><strong>Criticality:</strong> 1–5 (1=Low, 5=Mission Critical)</p>
              </div>

              <div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Choose CSV File
                </button>
              </div>

              {rows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Preview — {rows.length} row{rows.length !== 1 ? 's' : ''} ({validRows.length} valid,{' '}
                    {rows.length - validRows.length} with errors)
                  </p>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {['Name','Type','Manufacturer','Model','Serial','Department','Status','Crit.','Error'].map((h) => (
                            <th key={h} className="px-2 py-2 text-left font-medium text-gray-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={row._error ? 'bg-red-50' : ''}>
                            <td className="px-2 py-1">{row.name}</td>
                            <td className="px-2 py-1">{row.type}</td>
                            <td className="px-2 py-1">{row.manufacturer}</td>
                            <td className="px-2 py-1">{row.model}</td>
                            <td className="px-2 py-1">{row.serialNumber}</td>
                            <td className="px-2 py-1">{row.department}</td>
                            <td className="px-2 py-1">{row.status}</td>
                            <td className="px-2 py-1">{row.criticality}</td>
                            <td className="px-2 py-1 text-red-600">{row._error ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importing && (
                <p className="text-sm text-blue-600 font-medium">{progress}</p>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {importing ? 'Importing...' : `Import ${validRows.length} Machine${validRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MachineListPage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [filters, setFilters] = useState<Partial<MachineFilters>>({});
  const [showImport, setShowImport] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';

  const { machines, loading, error, hasMore, loadMore, totalCount } = useMachines({
    siteId,
    filters,
  });

  const filteredMachines = useMemo(() => {
    let result = machines;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          (m.model || '').toLowerCase().includes(search) ||
          (m.serialNumber || '').toLowerCase().includes(search) ||
          m.manufacturer.toLowerCase().includes(search),
      );
    }

    if (filters.departments && filters.departments.length > 0) {
      result = result.filter((m) => filters.departments!.includes(m.department));
    }

    if (filters.statuses && filters.statuses.length > 0) {
      result = result.filter((m) => filters.statuses!.includes(m.status));
    }

    if (filters.criticalities && filters.criticalities.length > 0) {
      result = result.filter((m) => filters.criticalities!.includes(m.criticality));
    }

    if (filters.healthScoreRange && (filters.healthScoreRange[0] > 0 || filters.healthScoreRange[1] < 100)) {
      const [min, max] = filters.healthScoreRange;
      result = result.filter((m) => m.healthScore >= min && m.healthScore <= max);
    }

    const sorted = [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [machines, filters, sortOrder]);

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  const canCreateMachine =
    userProfile.role === 'supervisor' ||
    userProfile.role === 'plant_manager' ||
    userProfile.role === 'admin';

  const activeMachines = machines.filter((m) => m.status === 'active').length;
  const maintenanceMachines = machines.filter((m) => m.status === 'under_maintenance').length;

  return (
    <div className="min-h-full">
      {showImport && (
        <ImportModal
          siteId={siteId}
          onClose={() => setShowImport(false)}
          onDone={() => {}}
        />
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Machine Registry</h1>
              <p className="text-gray-600 text-sm mt-1">
                {totalCount || machines.length} machines · {activeMachines} active · {maintenanceMachines} in maintenance
              </p>
            </div>

            <div className="flex gap-3">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white"
                aria-label="Sort machines"
              >
                <option value="asc">Sort: A → Z</option>
                <option value="desc">Sort: Z → A</option>
              </select>
              {canCreateMachine && (
                <Link
                  to="/app/machines/new"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  + Add Machine
                </Link>
              )}
              {canCreateMachine && (
                <button
                  onClick={() => setShowImport(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                >
                  Import
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <MachineFilterBar
          onFiltersChange={setFilters}
          departments={[...new Set(machines.map((m) => m.department).filter(Boolean))]}
          isLoading={loading}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        {loading && machines.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-2 bg-gray-100 rounded w-full mb-4" />
              </div>
            ))}
          </div>
        )}

        {!loading && filteredMachines.length === 0 && !error && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              {machines.length === 0 ? 'No machines registered yet' : 'No machines match your filters'}
            </p>
            {canCreateMachine && machines.length === 0 && (
              <Link
                to="/app/machines/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Machine
              </Link>
            )}
            {machines.length > 0 && filteredMachines.length === 0 && (
              <button
                onClick={() => setFilters({})}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {!loading && filteredMachines.length > 0 && isDesktop && (
          <div className="bg-white rounded-lg border border-gray-200">
            <MachineListTable
              machines={filteredMachines}
              onEdit={(machine) => navigate(`/app/machines/${machine.id}/edit`)}
            />
          </div>
        )}

        {!loading && filteredMachines.length > 0 && !isDesktop && (
          <div className="grid grid-cols-1 gap-4">
            {filteredMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
