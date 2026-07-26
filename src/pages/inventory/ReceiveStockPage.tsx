import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ReceiveAgainstPo } from '@/components/inventory/receive/ReceiveAgainstPo';

export function ReceiveStockPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Receive New Stock</h1>
      </div>
      <ReceiveAgainstPo />
    </div>
  );
}
export default ReceiveStockPage;
