import { useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import type { UserRole } from '@/types/auth';

/**
 * PM-081 — Import Users via a downloadable Excel template; on upload,
 * an invitation (with a role-specific registration link emailed to the user,
 * see PM-082/083) is created for each row.
 */

const TEMPLATE_COLUMNS = ['Full Name', 'Email', 'Role', 'Department', 'Designation', 'Employee ID'] as const;

const VALID_ROLES: UserRole[] = [
  'admin', 'plant_manager', 'supervisor', 'technician',
  'store_keeper', 'hr_officer', 'trainee', 'floor_operator',
];

export interface ParsedUserRow {
  fullName: string;
  email: string;
  role: UserRole;
  department: string | null;
  jobTitle: string | null;
  employeeId: string | null;
  error?: string;
}

interface Props {
  onClose: () => void;
  onImport: (rows: ParsedUserRow[]) => Promise<{ created: number; failed: number; errors: string[] }>;
}

function normalizeRole(value: string): UserRole | null {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (VALID_ROLES as string[]).includes(v) ? (v as UserRole) : null;
}

export function UsersBulkImportModal({ onClose, onImport }: Props) {
  const [rows, setRows] = useState<ParsedUserRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      [...TEMPLATE_COLUMNS],
      ['Jane Doe', 'jane@company.com', 'technician', 'Maintenance', 'Senior Technician', 'EMP-001'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'user-import-template.xlsx');
  }

  async function handleFile(file: File) {
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const parsed: ParsedUserRow[] = records.map((r) => {
        const get = (k: string) => String(r[k] ?? '').trim();
        const fullName = get('Full Name');
        const email = get('Email');
        const roleRaw = get('Role');
        const role = normalizeRole(roleRaw);
        let rowError: string | undefined;
        if (!fullName) rowError = 'Full Name is required';
        else if (!email) rowError = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowError = 'Invalid email';
        else if (!role) rowError = `Invalid role "${roleRaw}"`;
        return {
          fullName,
          email,
          role: role ?? 'technician',
          department: get('Department') || null,
          jobTitle: get('Designation') || null,
          employeeId: get('Employee ID') || null,
          error: rowError,
        };
      });

      if (parsed.length === 0) {
        setError('No rows found in the uploaded file.');
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse the file.');
    } finally {
      setParsing(false);
    }
  }

  const validRows = rows.filter((r) => !r.error);

  async function runImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Import Users</h2>
            <p className="text-xs text-slate-500 mt-0.5">Bulk-create invitations from an Excel template</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {result ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-800 font-semibold">
                {result.created} user{result.created === 1 ? '' : 's'} imported
              </p>
              {result.failed > 0 && (
                <p className="text-sm text-amber-700">{result.failed} row(s) failed.</p>
              )}
              {result.errors.length > 0 && (
                <ul className="text-left text-xs text-red-600 bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1A56DB] text-white hover:bg-[#1E40AF]">
                Done
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void downloadTemplate()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Download Excel template
              </button>

              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-8 cursor-pointer hover:bg-slate-50">
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {parsing ? 'Parsing…' : fileName || 'Click to upload .xlsx / .csv'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </label>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {rows.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-xs text-slate-600 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    {validRows.length} valid · {rows.length - validRows.length} with errors
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Role</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((r, i) => (
                          <tr key={i} className={r.error ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2">{r.fullName || '—'}</td>
                            <td className="px-3 py-2">{r.email || '—'}</td>
                            <td className="px-3 py-2">{r.role}</td>
                            <td className="px-3 py-2">
                              {r.error ? <span className="text-red-600">{r.error}</span> : <span className="text-emerald-600">Ready</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={validRows.length === 0 || importing}
                  onClick={() => void runImport()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {importing ? 'Importing…' : `Import ${validRows.length} user(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsersBulkImportModal;
