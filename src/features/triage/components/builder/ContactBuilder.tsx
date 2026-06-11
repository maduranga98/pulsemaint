import { useState } from 'react';
import { addContact, COL } from '../../api';
import { useAuthStore } from '../../../../store/authStore';
import { ContactList } from '../ContactList';

interface ContactForm {
  name: string;
  role: string;
  dept: string;
  phone: string;
  level: 'normal' | 'emergency';
}

const EMPTY: ContactForm = {
  name: '',
  role: '',
  dept: '',
  phone: '',
  level: 'normal',
};

export function ContactBuilder() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const uid = user?.uid ?? '';

  const [form, setForm] = useState<ContactForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await addContact(companyId, uid, { ...form });
      setForm(EMPTY);
    } finally {
      setSaving(false);
    }
  }

  const input = 'w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none';
  const inputStyle = {
    background: '#0e1628',
    border: '1px solid #1a2840',
    color: '#e2e8f0',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#111d2e', border: '1px solid #1a2840' }}
      >
        <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
          Add Contact
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
              Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={input}
              style={inputStyle}
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
              Role
            </label>
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={input}
              style={inputStyle}
              placeholder="e.g. Maintenance Supervisor"
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
              Department
            </label>
            <input
              value={form.dept}
              onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}
              className={input}
              style={inputStyle}
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: '#6b7fa3' }}>
              Phone / Extension *
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={input}
              style={inputStyle}
              placeholder="e.g. ext. 555 or +1 555-0100"
              required
            />
          </div>
          <div>
            <label className="text-xs block mb-2" style={{ color: '#6b7fa3' }}>
              Priority
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'emergency'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, level: lvl }))}
                  className="py-2 rounded-lg text-xs font-medium transition-colors capitalize flex items-center justify-center gap-1.5"
                  style={{
                    background: form.level === lvl
                      ? lvl === 'emergency' ? '#ef444422' : '#1d4ed822'
                      : '#1a2840',
                    color: form.level === lvl
                      ? lvl === 'emergency' ? '#ef4444' : '#3b82f6'
                      : '#6b7fa3',
                    border: `1px solid ${
                      form.level === lvl
                        ? lvl === 'emergency' ? '#ef444440' : '#3b82f640'
                        : 'transparent'
                    }`,
                  }}
                >
                  {lvl === 'emergency' ? '🚨' : '👤'} {lvl}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !form.name.trim() || !form.phone.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#1d4ed8', color: 'white' }}
          >
            {saving ? 'Saving...' : '+ Add Contact'}
          </button>
        </form>
      </div>

      {/* Live list */}
      <div
        className="rounded-xl p-4"
        style={{ background: '#0e1628', border: '1px solid #1a2840' }}
      >
        <div className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
          Current Contacts
        </div>
        <ContactList showDelete />
      </div>
    </div>
  );
}
