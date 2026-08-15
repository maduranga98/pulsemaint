import { useAuthStore } from '../../store/authStore';
import InventoryHealthStrip from '../../components/dashboard/inventory/InventoryHealthStrip';
import LowStockAlertTable from '../../components/dashboard/inventory/LowStockAlertTable';
import PendingRequestsTable from '../../components/dashboard/inventory/PendingRequestsTable';
import PendingReturnsWidget from '../../components/dashboard/inventory/PendingReturnsWidget';
import PendingReceiptPOsWidget from '../../components/dashboard/inventory/PendingReceiptPOsWidget';
import SafetyForYouWidget from '../../components/dashboard/inventory/SafetyForYouWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';

export default function InventoryDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Store Keeper';

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Inventory Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* KPI Strip */}
        <InventoryHealthStrip companyId={companyId} />

        {/* Low Stock + Pending Requests */}
        <LowStockAlertTable companyId={companyId} />
        <PendingRequestsTable companyId={companyId} />

        {/* Returns awaiting store keeper action + POs sent but not yet received */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingReturnsWidget companyId={companyId} />
          <PendingReceiptPOsWidget companyId={companyId} />
        </div>

        {/* Safety — trainings assigned to this user and cases reported to them */}
        <SafetyForYouWidget />
      </div>

      <DashboardSidePanel />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
