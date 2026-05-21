import { X } from 'lucide-react';
import { useDashboardStore } from '../../../store/dashboard.store';

export default function DashboardSidePanel() {
  const sidePanel = useDashboardStore((s) => s.sidePanel);
  const closeSidePanel = useDashboardStore((s) => s.closeSidePanel);

  const isOpen = sidePanel.type !== null && sidePanel.id !== null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeSidePanel}
        />
      )}

      {/* Panel — desktop: slide from right, mobile: bottom sheet */}
      <aside
        className={`fixed z-50 transition-transform duration-300 ease-in-out bg-[#0A1628] border-l border-[#1E3A5F] shadow-2xl
          /* Desktop */
          lg:right-0 lg:top-0 lg:h-full lg:w-[480px] lg:translate-x-full
          /* Mobile */
          max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:h-[80vh] max-lg:rounded-t-2xl max-lg:translate-y-full
          ${isOpen ? 'lg:translate-x-0 max-lg:translate-y-0' : ''}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E3A5F]">
          <h3 className="text-base font-semibold text-[#F0F4F8] font-[Sora] capitalize">
            {sidePanel.type ? sidePanel.type.replace('_', ' ') : ''} Detail
          </h3>
          <button
            onClick={closeSidePanel}
            className="p-1.5 rounded-md text-[#8BA3BF] hover:text-[#F0F4F8] hover:bg-[#1E3A5F]/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto h-[calc(100%-64px)]">
          {sidePanel.type && sidePanel.id ? (
            <div className="space-y-4">
              <p className="text-sm text-[#8BA3BF]">
                {sidePanel.type} ID: <span className="text-[#F0F4F8] font-mono">{sidePanel.id}</span>
              </p>
              <div className="p-4 bg-[#0F1E35] border border-[#1E3A5F] rounded-lg">
                <p className="text-xs text-[#8BA3BF]">
                  Side panel content for {sidePanel.type} will be wired to detail views in a future
                  iteration.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#8BA3BF]">Select an item to view details.</p>
          )}
        </div>
      </aside>
    </>
  );
}
