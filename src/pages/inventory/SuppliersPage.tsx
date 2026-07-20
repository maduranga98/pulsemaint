import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  serverTimestamp,
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

export function SuppliersPage() {
  const { addToast } = useToast();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const { suppliers, loading } = useSuppliers();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
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
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {[s.contactPerson, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label="Edit supplier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  disabled={deletingId === s.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  aria-label="Remove supplier"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
