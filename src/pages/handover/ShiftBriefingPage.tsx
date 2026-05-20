import { Link } from 'react-router-dom';
import { usePendingHandover } from '@/hooks/usePendingHandover';
import ShiftBriefingScreen from '@/components/handover/ShiftBriefingScreen';

export function ShiftBriefingPage() {
  const { pendingHandover } = usePendingHandover();

  if (!pendingHandover) {
    return (
      <div className="p-4 lg:p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          No pending shift briefing.
          <Link to="/app/dashboard" className="ml-2 font-semibold text-blue-700">Return to dashboard</Link>
        </div>
      </div>
    );
  }

  return <ShiftBriefingScreen handover={pendingHandover} />;
}

export default ShiftBriefingPage;
