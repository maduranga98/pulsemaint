import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PhysicalIssueScreen } from '@/components/inventory/issue/PhysicalIssueScreen';

export function PhysicalIssuePage() {
  const canIssue = useAuthStore((s) =>
    s.canAccess(['store_keeper', 'supervisor', 'admin'])
  );

  if (!canIssue) {
    return <Navigate to="/app/inventory/requests" replace />;
  }

  return <PhysicalIssueScreen />;
}
export default PhysicalIssuePage;
