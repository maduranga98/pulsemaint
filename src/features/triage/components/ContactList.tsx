import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Phone, Trash2 } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { deleteContact, COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageContact } from '../types';

interface Props {
  showDelete?: boolean;
  /** Narrow panels (the builder's side column): one card per row so nothing is squeezed. */
  compact?: boolean;
}

/** `tel:` link target, or null when the stored value is only an extension label. */
function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+*#]/g, '');
  return digits.replace(/\D/g, '').length >= 3 ? `tel:${digits}` : null;
}

export function ContactList({ showDelete = false, compact = false }: Props) {
  const { t } = useTranslation();
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

  const emergency = contacts.filter((c) => c.level === 'emergency');
  const normal = contacts.filter((c) => c.level !== 'emergency');
  const gridClass = compact
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

  function PhoneButton({ contact, urgent }: { contact: TriageContact; urgent: boolean }) {
    const href = telHref(contact.phone);
    const className =
      'flex items-center justify-center gap-2 rounded-lg px-4 min-h-[44px] text-sm font-semibold whitespace-nowrap no-underline';
    const style = urgent
      ? { background: '#dc2626', color: '#ffffff' }
      : { background: '#12203d', color: '#bfdbfe', border: '1px solid #2b4170' };
    const content = (
      <>
        <Phone className="w-4 h-4 shrink-0" /> {contact.phone}
      </>
    );
    return href ? (
      <a
        href={href}
        className={className}
        style={style}
        aria-label={t('common.triage.knowledge.page.callPerson', { name: contact.name })}
      >
        {content}
      </a>
    ) : (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  function Card({ contact, urgent }: { contact: TriageContact; urgent: boolean }) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{
          background: urgent ? '#2a1618' : '#0e1628',
          border: urgent ? '2px solid #dc2626' : '1px solid #1f2f4a',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
              {contact.name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: urgent ? '#e5b4b4' : '#6b7fa3' }}>
              {[contact.role, contact.dept].filter(Boolean).join(' · ')}
            </div>
          </div>
          {showDelete && (
            <button
              onClick={() => deleteContact(contact.id)}
              className="p-2 opacity-60 hover:opacity-100 transition-opacity"
              title={t('common.triage.knowledge.contactList.deleteTitle')}
              aria-label={t('common.triage.knowledge.contactList.deleteTitle')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <PhoneButton contact={contact} urgent={urgent} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {contacts.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#0e1628', border: '1px solid #1f2f4a' }}
        >
          <div className="text-sm" style={{ color: '#6b7fa3' }}>
            {t('common.triage.knowledge.contactList.empty')}
          </div>
        </div>
      )}

      {emergency.length > 0 && (
        <section aria-label={t('common.triage.knowledge.page.emergencyHeading')} className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: '#fecaca' }}>
            {t('common.triage.knowledge.page.emergencyHeading')}
          </h2>
          <div className={gridClass}>
            {emergency.map((c) => (
              <Card key={c.id} contact={c} urgent />
            ))}
          </div>
        </section>
      )}

      {normal.length > 0 && (
        <section aria-label={t('common.triage.knowledge.page.otherPeople')} className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
            {t('common.triage.knowledge.page.otherPeople')}
          </h2>
          <div className={gridClass}>
            {normal.map((c) => (
              <Card key={c.id} contact={c} urgent={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
