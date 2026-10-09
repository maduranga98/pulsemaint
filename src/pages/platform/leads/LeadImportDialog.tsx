import { useState } from 'react';
import { Upload } from 'lucide-react';
import { LEAD_SOURCES, parseImportRows, phoneKey, type Lead, type LeadInput, type TeamMember } from '@/lib/platform/leads';
import { importLeads } from '@/services/platformLeadsService';
import { ErrorNote, btn, input } from '../platformUi';
import { Field, Modal } from './leadUi';

const MAX_ROWS = 2000;

/**
 * Bulk-import leads from a CSV / Excel export (Facebook Lead Ads, Google
 * Sheets, a marketer's spreadsheet). Headers are matched by name; numbers
 * already on the board are skipped as duplicates.
 */
export default function LeadImportDialog({ leads, team, onClose, onDone }: { leads: Lead[]; team: TeamMember[]; onClose: () => void; onDone: (n: number) => void }) {
  const [rows, setRows] = useState<LeadInput[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [dupes, setDupes] = useState(0);
  const [source, setSource] = useState('Facebook ad');
  const [campaign, setCampaign] = useState('');
  const [marketerId, setMarketerId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setError('');
    setRows(null);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
      if (table.length - 1 > MAX_ROWS) throw new Error(`That file has ${table.length - 1} rows — import at most ${MAX_ROWS} at a time.`);
      const res = parseImportRows(table, { source });
      const existing = new Set(leads.map((l) => phoneKey(l.phone)).filter((k) => k.length >= 9));
      const seen = new Set<string>();
      const fresh = res.leads.filter((l) => {
        const k = phoneKey(l.phone);
        if (k.length < 9) return true;
        if (existing.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setDupes(res.leads.length - fresh.length);
      setSkipped(res.skipped);
      setRows(fresh);
    } catch (e) {
      setError((e as Error).message || 'Could not read that file');
    }
  }

  async function run() {
    if (!rows?.length) return;
    setBusy(true);
    setError('');
    try {
      const prepared = rows.map((r) => ({
        ...r,
        source: r.source || source,
        campaign: r.campaign || campaign,
        marketerId: marketerId || null,
        assignedTo: assignedTo || null,
      }));
      onDone(await importLeads(prepared));
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  const active = team.filter((m) => m.active);

  return (
    <Modal
      title={<><Upload className="h-4 w-4 text-blue-300" /> Import leads</>}
      onClose={onClose}
      footer={<>
        <button className={btn.ghost} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || !rows?.length} onClick={() => void run()}>{busy ? 'Importing…' : `Import ${rows?.length ?? 0} lead(s)`}</button>
      </>}
    >
      <p className="mb-3 text-sm text-slate-400">
        CSV or Excel. The first row must be headers — columns like <i>business name, full name, phone, email, city, district, campaign name, created time, notes</i> are recognised
        (Facebook Lead Ads exports work as-is). Rows without a name and a phone/email are skipped; numbers already on the board are skipped as duplicates.
      </p>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source (when the file has none)">
          <input className={input} list="import-sources" value={source} onChange={(e) => setSource(e.target.value)} />
          <datalist id="import-sources">{LEAD_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Campaign (when the file has none)"><input className={input} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Oct factory ad" /></Field>
        <Field label="Brought in by">
          <select className={input} value={marketerId} onChange={(e) => setMarketerId(e.target.value)}>
            <option value="">— Lumora (direct)</option>
            {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Assign to">
          <select className={input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">— Unassigned</option>
            {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 p-6 text-sm text-slate-300 hover:bg-slate-800/50 sm:col-span-2">
          <Upload className="h-6 w-6 text-slate-400" />
          {fileName || 'Choose a .csv / .xlsx file'}
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
        </label>
      </div>
      {rows && (
        <div className="mt-4">
          <p className="text-sm text-slate-300">
            <b className="text-white">{rows.length}</b> new lead(s) ready{dupes > 0 && <> · {dupes} duplicate number(s) skipped</>}{skipped > 0 && <> · {skipped} row(s) without contact details skipped</>}.
          </p>
          {rows.length > 0 && (
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-[#1E3A5F]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0A1628] text-slate-400"><tr><th className="px-2 py-1.5">Business</th><th className="px-2 py-1.5">Contact</th><th className="px-2 py-1.5">Phone</th><th className="px-2 py-1.5">Location</th></tr></thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-[#1E3A5F]"><td className="px-2 py-1 text-white">{r.businessName}</td><td className="px-2 py-1">{r.contactPerson}</td><td className="px-2 py-1 font-mono">{r.phone}</td><td className="px-2 py-1">{r.location}</td></tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <p className="p-2 text-xs text-slate-500">…and {rows.length - 50} more</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
