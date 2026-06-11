import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../../lib/firebase';
import type { Machine, IsolationPoint, IsolationPointType } from '../../types/machine';
import { Zap, Droplets, Wind, Settings, Flame, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

interface IsolationPointsTabProps {
  machine: Machine;
  canEdit: boolean;
}

const TYPE_OPTIONS: { value: IsolationPointType; label: string }[] = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'thermal', label: 'Thermal' },
];

const TYPE_COLORS: Record<IsolationPointType, string> = {
  electrical: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hydraulic: 'bg-blue-100 text-blue-700 border-blue-200',
  pneumatic: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  mechanical: 'bg-gray-100 text-gray-700 border-gray-200',
  thermal: 'bg-red-100 text-red-700 border-red-200',
};

function TypeIcon({ type }: { type: IsolationPointType }) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'electrical': return <Zap className={cls} />;
    case 'hydraulic': return <Droplets className={cls} />;
    case 'pneumatic': return <Wind className={cls} />;
    case 'mechanical': return <Settings className={cls} />;
    case 'thermal': return <Flame className={cls} />;
  }
}

interface IpFormState {
  type: IsolationPointType;
  label: string;
  location: string;
}

const emptyForm = (): IpFormState => ({ type: 'electrical', label: '', location: '' });

export function IsolationPointsTab({ machine, canEdit }: IsolationPointsTabProps) {
  const points: IsolationPoint[] = machine.isolationPoints ?? [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<IpFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IpFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function savePoints(updated: IsolationPoint[]) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'machines', machine.id), {
        isolationPoints: updated,
        updatedAt: serverTimestamp(),
      });
      toast.success('Isolation points updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!addForm.label.trim()) {
      toast.error('Label is required');
      return;
    }
    const newPoint: IsolationPoint = {
      id: nanoid(),
      type: addForm.type,
      label: addForm.label.trim(),
      location: addForm.location.trim(),
    };
    await savePoints([...points, newPoint]);
    setAddForm(emptyForm());
    setShowAddForm(false);
  }

  function startEdit(point: IsolationPoint) {
    setEditingId(point.id);
    setEditForm({ type: point.type, label: point.label, location: point.location });
  }

  async function handleEditSave() {
    if (!editForm.label.trim()) {
      toast.error('Label is required');
      return;
    }
    const updated = points.map((p) =>
      p.id === editingId
        ? { ...p, type: editForm.type, label: editForm.label.trim(), location: editForm.location.trim() }
        : p,
    );
    await savePoints(updated);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this isolation point?')) return;
    await savePoints(points.filter((p) => p.id !== id));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Isolation Points</h3>
        {canEdit && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Isolation Point
          </button>
        )}
      </div>

      {points.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-500 py-4 text-center">
          No isolation points defined for this machine.
        </p>
      )}

      {/* Existing points */}
      <div className="space-y-2">
        {points.map((point) => {
          if (editingId === point.id) {
            return (
              <div key={point.id} className="border border-blue-300 rounded-xl p-3 bg-blue-50 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as IsolationPointType })}
                    className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    placeholder="Label"
                    className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
                  />
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="Location"
                    className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={saving}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={point.id}
              className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
            >
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[point.type]}`}>
                <TypeIcon type={point.type} />
                {point.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{point.label}</p>
                {point.location && <p className="text-xs text-gray-500">{point.location}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(point)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(point.id)}
                    disabled={saving}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="border border-blue-300 rounded-xl p-3 bg-blue-50 space-y-2">
          <p className="text-sm font-medium text-gray-700">New Isolation Point</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={addForm.type}
              onChange={(e) => setAddForm({ ...addForm, type: e.target.value as IsolationPointType })}
              className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={addForm.label}
              onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
              placeholder="Label (e.g. Main Power Breaker)"
              className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
            />
            <input
              type="text"
              value={addForm.location}
              onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
              placeholder="Location (e.g. Panel B, Row 3)"
              className="text-sm rounded-lg border border-gray-300 px-3 py-1.5"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddForm(emptyForm()); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Point'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
