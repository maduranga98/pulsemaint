import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PurchaseOrderForm } from '@/components/inventory/po/PurchaseOrderForm';
import type { PurchaseOrder } from '@/types/inventory';

export function CreatePurchaseOrderPage() {
  const navigate = useNavigate();

  function handleSave(saved: PurchaseOrder) {
    navigate(`/app/inventory/purchase-orders/${saved.id}`);
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory/purchase-orders" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Create Purchase Order</h1>
      </div>
      <PurchaseOrderForm onSave={handleSave} />
    </div>
  );
}
export default CreatePurchaseOrderPage;
