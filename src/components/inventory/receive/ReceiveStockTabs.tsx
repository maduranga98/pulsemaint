import { useState } from 'react';
import { ReceiveAgainstPo } from './ReceiveAgainstPo';
import { ReceiveWithoutPo } from './ReceiveWithoutPo';

type TabId = 'against_po' | 'without_po';

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'against_po', label: 'Against Purchase Order' },
  { id: 'without_po', label: 'Without PO' },
];

export function ReceiveStockTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('against_po');

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'against_po' ? <ReceiveAgainstPo /> : <ReceiveWithoutPo />}
    </div>
  );
}
