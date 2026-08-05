import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { ClipboardCheck, Pin, UserCog, type LucideIcon } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageCategory } from '../types';
import { TriageCategoryIcon } from '../triageIcons';

export type PanelId = 'contacts' | 'assessments' | string;

interface Props {
  selected: PanelId;
  onSelect: (id: PanelId) => void;
}

export function CategoryRail({ selected, onSelect }: Props) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const [cats, setCats] = useState<TriageCategory[]>([]);

  useEffect(() => {
    if (!companyId) return;
    // Sorted client-side rather than via Firestore orderBy — see TriagePage
    // for why (missing composite index makes the query fail silently).
    return onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
      ),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory));
        list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.order ?? 0) - (b.order ?? 0));
        setCats(list);
      },
    );
  }, [companyId]);

  function RailBtn({
    id,
    label,
    icon: Icon,
    color,
  }: {
    id: PanelId;
    label: string;
    icon: LucideIcon;
    color: string;
  }) {
    const active = selected === id;
    return (
      <button
        onClick={() => onSelect(id)}
        className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
        style={{
          background: active ? color + '1e' : 'transparent',
          border: `1px solid ${active ? color + '66' : 'transparent'}`,
          color: active ? color : '#6b7fa3',
        }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 font-medium">{label}</span>
      </button>
    );
  }

  return (
    <div
      className="w-full max-h-80 sm:w-[250px] sm:max-h-none sm:shrink-0 rounded-xl flex flex-col overflow-hidden"
      style={{ background: '#0a0f1c', border: '1px solid #1a2840' }}
    >
      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-3">
        <div
          className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1"
          style={{ color: '#3d5070' }}
        >
          Categories
        </div>
        <div className="space-y-0.5">
          {cats.map((cat) => {
            const active = selected === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
                style={{
                  background: active ? cat.color + '1e' : 'transparent',
                  border: `1px solid ${active ? cat.color + '66' : 'transparent'}`,
                  color: active ? cat.color : '#6b7fa3',
                }}
              >
                <TriageCategoryIcon icon={cat.icon} className="w-4 h-4 shrink-0" />
                <span className="flex-1 font-medium truncate">{cat.title}</span>
                {cat.pinned && <Pin className="w-3 h-3 shrink-0" style={{ color: '#3d5070' }} />}
              </button>
            );
          })}
          {cats.length === 0 && (
            <div className="text-xs text-center py-6" style={{ color: '#3d5070' }}>
              No categories yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="p-3 space-y-0.5" style={{ borderTop: '1px solid #1a2840' }}>
        <RailBtn id="contacts" label="Responsible Persons" icon={UserCog} color="#f97316" />
        <RailBtn id="assessments" label="Quick Assessments" icon={ClipboardCheck} color="#fbbf24" />
      </div>
    </div>
  );
}
