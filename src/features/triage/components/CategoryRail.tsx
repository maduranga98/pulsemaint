import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { COL } from '../api';
import { useAuthStore } from '../../../store/authStore';
import type { TriageCategory } from '../types';

export type PanelId = 'ai' | 'contacts' | 'assessments' | string;

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
    return onSnapshot(
      query(
        collection(db, COL.categories),
        where('companyId', '==', companyId),
        orderBy('pinned', 'desc'),
        orderBy('order', 'asc'),
      ),
      (snap) => {
        setCats(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageCategory)),
        );
      },
    );
  }, [companyId]);

  function RailBtn({
    id,
    label,
    icon,
    color,
  }: {
    id: PanelId;
    label: string;
    icon: string;
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
        <span className="text-base shrink-0">{icon}</span>
        <span className="flex-1 font-medium">{label}</span>
      </button>
    );
  }

  return (
    <div
      className="shrink-0 rounded-xl flex flex-col overflow-hidden"
      style={{ width: 250, background: '#0a0f1c', border: '1px solid #1a2840' }}
    >
      {/* Assistant section */}
      <div className="p-3" style={{ borderBottom: '1px solid #1a2840' }}>
        <div
          className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1"
          style={{ color: '#3d5070' }}
        >
          Assistant
        </div>
        <RailBtn id="ai" label="AI Triage" icon="🤖" color="#a78bfa" />
      </div>

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
                <span className="text-base shrink-0">{cat.icon}</span>
                <span className="flex-1 font-medium truncate">{cat.title}</span>
                {cat.pinned && (
                  <span className="text-[10px] shrink-0" style={{ color: '#3d5070' }}>
                    📌
                  </span>
                )}
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
        <RailBtn id="contacts" label="Responsible Persons" icon="🟤" color="#f97316" />
        <RailBtn id="assessments" label="Quick Assessments" icon="🟡" color="#fbbf24" />
      </div>
    </div>
  );
}
