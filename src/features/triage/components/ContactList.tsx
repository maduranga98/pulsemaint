import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { deleteContact, COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageContact } from '../types';

interface Props {
  showDelete?: boolean;
}

export function ContactList({ showDelete = false }: Props) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const [contacts, setContacts] = useState<TriageContact[]>([]);

  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      query(collection(db, COL.contacts), where('companyId', '==', companyId)),
      (snap) => {
        setContacts(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageContact)),
        );
      },
    );
  }, [companyId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🟤</span>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>
            Responsible Persons
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7fa3' }}>
            Emergency contacts and key personnel
          </p>
        </div>
      </div>

      {contacts.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#111d2e', border: '1px solid #1a2840' }}
        >
          <div className="text-sm" style={{ color: '#3d5070' }}>
            No contacts added yet.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="rounded-xl p-4"
            style={{
              background: '#111d2e',
              border: `1px solid ${contact.level === 'emergency' ? '#ef4444' : '#1a2840'}`,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">
                {contact.level === 'emergency' ? '🚨' : '👤'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>
                  {contact.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#6b7fa3' }}>
                  {contact.role} · {contact.dept}
                </div>
                <div
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: '#1a2840',
                    color: contact.level === 'emergency' ? '#ef4444' : '#e2e8f0',
                  }}
                >
                  📞 {contact.phone}
                </div>
              </div>
              {showDelete && (
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="text-lg opacity-50 hover:opacity-100 transition-opacity"
                  title="Delete contact"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
