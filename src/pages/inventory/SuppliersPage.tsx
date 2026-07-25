import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Trash2, X, Upload, Download, ChevronDown } from 'lucide-react';
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useSuppliers } from '@/hooks/inventory/useSuppliers';
import { useToast } from '@/hooks/useToast';
import { getNextSupplierCode, getSupplierCodeSequenceMap, nextSupplierCodeFromCounter } from '@/lib/inventory/supplierCodeGenerator';
import type { Supplier } from '@/types/inventory';

interface SupplierFormValues {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  website: string;
  paymentMethod: string;
  bankDetails: string;
  notes: string;
}

const emptyForm: SupplierFormValues = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  country: '',
  website: '',
  paymentMethod: '',
  bankDetails: '',
  notes: '',
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const SAMPLE_CSV =
  'name,contactPerson,phone,email,address,country,website,paymentMethod,bankDetails,notes\n' +
  'Acme Bearings,John Perera,+94 77 123 4567,sales@acmebearings.lk,"12 Industrial Rd, Colombo",LK,https://acmebearings.lk,Bank Transfer,"Commercial Bank, Acc 1234567",Preferred bearing supplier\n' +
  'Lanka Hydraulics,Nimal Silva,+94 71 987 6543,info@lankahydraulics.lk,"45 Factory Ave, Gampaha",LK,https://lankahydraulics.lk,Cheque,"HNB, Acc 7654321",Net 30 payment terms\n';

// Minimal CSV parser handling quoted fields and embedded commas/quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
  }
  return rows;
}

// Parses an .xlsx file's first sheet into the same string[][] shape parseCsv
// produces, so the rest of the import logic is format-agnostic.
async function parseXlsxRows(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
  return raw
    .map((row) => row.map((c) => (c === undefined || c === null ? '' : String(c).trim())))
    .filter((row) => row.some((v) => v !== ''));
}

export function SuppliersPage() {
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const role = useAuthStore((s) => s.userProfile?.role);
  // firestore.rules only allows plant_manager/admin to delete a supplier doc
  // (store_keeper/supervisor can create & edit, same as parts and POs) — the
  // delete button must stay hidden for the other roles that can reach this
  // page, otherwise it renders as a working action that always fails with a
  // permission-denied error when clicked.
  const canDelete = role === 'plant_manager' || role === 'admin';
  const { suppliers, loading } = useSuppliers();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after a failed import.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!companyId) {
      addToast('Missing company context. Please re-login.', 'error');
      return;
    }
    setImporting(true);
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx');
      const rows: string[][] = isExcel ? await parseXlsxRows(file) : parseCsv(await file.text());
      if (rows.length < 2) {
        addToast('File has no data rows. Use the sample as a starting point.', 'error');
        return;
      }
      // Normalize away spaces/underscores/hyphens so "Contact Person",
      // "contact_person", and "contactPerson" all match the same column —
      // real-world files rarely use the exact camelCase header from the
      // sample, and a strict match was silently leaving those fields blank.
      const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '');
      const header = rows[0].map(normalize);
      const col = (name: string) => header.indexOf(normalize(name));
      const nameIdx = col('name');
      if (nameIdx === -1) {
        addToast('File must include a "name" column (see the sample).', 'error');
        return;
      }
      const idx = {
        contactPerson: col('contactperson'),
        phone: col('phone'),
        email: col('email'),
        address: col('address'),
        country: col('country'),
        website: col('website'),
        paymentMethod: col('paymentmethod'),
        bankDetails: col('bankdetails'),
        notes: col('notes'),
      };
      const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

      const records = rows.slice(1)
        .filter((r) => at(r, nameIdx) !== '')
        .map((r) => ({
          name: at(r, nameIdx),
          contactPerson: at(r, idx.contactPerson),
          phone: at(r, idx.phone),
          email: at(r, idx.email),
          address: at(r, idx.address),
          country: at(r, idx.country),
          website: at(r, idx.website),
          paymentMethod: at(r, idx.paymentMethod),
          bankDetails: at(r, idx.bankDetails),
          notes: at(r, idx.notes),
        }));

      if (records.length === 0) {
        addToast('No valid supplier rows found in the file.', 'error');
        return;
      }

      // Firestore batches cap at 500 writes.
      const codeCounters = await getSupplierCodeSequenceMap(companyId);
      for (let i = 0; i < records.length; i += 400) {
        const batch = writeBatch(db);
        for (const rec of records.slice(i, i + 400)) {
          const ref = doc(collection(db, 'suppliers'));
          batch.set(ref, {
            ...rec,
            supplierCode: nextSupplierCodeFromCounter(codeCounters, rec.country),
            companyId,
            createdAt: serverTimestamp(),
            createdBy: userId,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          });
        }
        await batch.commit();
      }
      addToast(`Imported ${records.length} supplier${records.length === 1 ? '' : 's'}.`, 'success');
    } catch (err) {
      console.error('Supplier CSV import failed', err);
      addToast('Failed to import suppliers. Check the CSV format against the sample.', 'error');
    } finally {
      setImporting(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      country: supplier.country ?? '',
      website: supplier.website ?? '',
      paymentMethod: supplier.paymentMethod ?? '',
      bankDetails: supplier.bankDetails ?? '',
      notes: supplier.notes,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      addToast('Supplier name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'suppliers', editing.id), {
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
        addToast('Supplier updated.', 'success');
      } else {
        const supplierCode = await getNextSupplierCode(companyId, form.country);
        await addDoc(collection(db, 'suppliers'), {
          ...form,
          supplierCode,
          companyId,
          createdAt: serverTimestamp(),
          createdBy: userId,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
        addToast(`Supplier added (${supplierCode}).`, 'success');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      addToast('Failed to save supplier.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (!window.confirm(`Remove supplier "${supplier.name}"?`)) return;
    setDeletingId(supplier.id);
    try {
      await deleteDoc(doc(db, 'suppliers', supplier.id));
      addToast('Supplier removed.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to remove supplier.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora] flex-1">Suppliers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={downloadSample}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg"
          >
            <Download className="w-4 h-4" />
            Sample CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importing…' : 'Import (CSV/Excel)'}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => <div key={k} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm bg-white border border-gray-200 rounded-xl">
          No suppliers yet. Add your first supplier to select them when creating a purchase order.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {suppliers.map((s) => {
            const expanded = expandedId === s.id;
            return (
              <div key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="min-w-0 flex items-center gap-2 text-left flex-1"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">{s.name}</span>
                        {s.supplierCode && (
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{s.supplierCode}</span>
                        )}
                      </span>
                      <span className="block text-sm text-gray-500 truncate">
                        {[s.contactPerson, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
                      </span>
                    </span>
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label="Edit supplier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Remove supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Contact Person</dt>
                      <dd className="text-gray-800">{s.contactPerson || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Phone</dt>
                      <dd className="text-gray-800">{s.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Email</dt>
                      <dd className="text-gray-800 break-all">{s.email || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Address</dt>
                      <dd className="text-gray-800 whitespace-pre-line">{s.address || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Country</dt>
                      <dd className="text-gray-800">{s.country || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Website</dt>
                      <dd className="text-gray-800 break-all">
                        {s.website ? (
                          <a href={s.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {s.website}
                          </a>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Payment Method</dt>
                      <dd className="text-gray-800">{s.paymentMethod || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Bank Details</dt>
                      <dd className="text-gray-800">{s.bankDetails || '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-gray-400">Notes</dt>
                      <dd className="text-gray-800 whitespace-pre-line">{s.notes || '—'}</dd>
                    </div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  placeholder="Supplier / company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className={inputCls}
                    placeholder="e.g. LK or Sri Lanka"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    className={inputCls}
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <input
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    className={inputCls}
                    placeholder="e.g. Bank Transfer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Details</label>
                  <input
                    value={form.bankDetails}
                    onChange={(e) => setForm((f) => ({ ...f, bankDetails: e.target.value }))}
                    className={inputCls}
                    placeholder="Bank, account #"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default SuppliersPage;
