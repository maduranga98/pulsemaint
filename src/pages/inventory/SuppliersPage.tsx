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
import type { Supplier } from '@/types/inventory';

interface SupplierFormValues {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyForm: SupplierFormValues = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const SAMPLE_CSV =
  'name,contactPerson,phone,email,address,notes\n' +
  'Acme Bearings,John Perera,+94 77 123 4567,sales@acmebearings.lk,"12 Industrial Rd, Colombo",Preferred bearing supplier\n' +
  'Lanka Hydraulics,Nimal Silva,+94 71 987 6543,info@lankahydraulics.lk,"45 Factory Ave, Gampaha",Net 30 payment terms\n';

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
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        addToast('CSV has no data rows. Use the sample as a starting point.', 'error');
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const nameIdx = col('name');
      if (nameIdx === -1) {
        addToast('CSV must include a "name" column (see the sample).', 'error');
        return;
      }
      const idx = {
        contactPerson: col('contactperson'),
        phone: col('phone'),
        email: col('email'),
        address: col('address'),
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
          notes: at(r, idx.notes),
        }));

      if (records.length === 0) {
        addToast('No valid supplier rows found in the CSV.', 'error');
        return;
      }

      // Firestore batches cap at 500 writes.
      for (let i = 0; i < records.length; i += 400) {
        const batch = writeBatch(db);
        for (const rec of records.slice(i, i + 400)) {
          const ref = doc(collection(db, 'suppliers'));
          batch.set(ref, {
            ...rec,
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
        await addDoc(collection(db, 'suppliers'), {
          ...form,
          companyId,
          createdAt: serverTimestamp(),
          createdBy: userId,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
        addToast('Supplier added.', 'success');
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
            accept=".csv,text/csv"
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
            {importing ? 'Importing…' : 'Import CSV'}
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
                      <span className="block font-semibold text-gray-900 truncate">{s.name}</span>
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
