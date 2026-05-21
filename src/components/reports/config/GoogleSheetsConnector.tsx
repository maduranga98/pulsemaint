import { Table2 } from 'lucide-react';
import { useGoogleSheetsAuth } from '../../../hooks/reports/useGoogleSheetsAuth';

export default function GoogleSheetsConnector({ visible }: { visible: boolean }) {
  const { isConnected, connect, disconnect } = useGoogleSheetsAuth();
  if (!visible) return null;

  return (
    <section className="space-y-2 border-b border-[#1E3A5F] pb-5">
      <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">Google Sheets</h3>
      <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[#F0F4F8]">
            <Table2 className="h-4 w-4 text-[#10B981]" />
            {isConnected ? 'Google account connected' : 'Connect Google account'}
          </div>
          <button type="button" onClick={isConnected ? disconnect : () => void connect()} className="min-h-10 rounded-lg border border-[#1E3A5F] px-3 text-xs font-semibold text-[#F0F4F8]">
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
        {isConnected && <p className="mt-2 text-xs text-[#8BA3BF]">Push to a new Sheet will create a formatted spreadsheet.</p>}
      </div>
    </section>
  );
}
