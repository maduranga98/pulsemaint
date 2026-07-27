import type { InventoryPart } from '@/types/inventory';
import { CostDisplay } from '@/components/inventory/shared/CostDisplay';
import { StockGauge } from '@/components/inventory/shared/StockGauge';
import { UnitLabel } from '@/components/inventory/shared/UnitLabel';
import { useAuthStore } from '@/store/authStore';
import { useSuppliers } from '@/hooks/inventory/useSuppliers';
import { useMachineOptions } from '@/hooks/inventory/useMachineOptions';
import { formatLKR } from '@/lib/inventory/stockCalculator';
import { formatDistanceToNow, formatDate } from '@/lib/dateUtils';
import { Link } from 'react-router-dom';
import { Phone, Mail, Cpu } from 'lucide-react';

interface PartOverviewTabProps {
  part: InventoryPart;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right font-medium">{value || <span className="text-gray-400 font-normal">—</span>}</span>
    </div>
  );
}

function tsToDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export function PartOverviewTab({ part }: PartOverviewTabProps) {
  const isTechnician = useAuthStore((s) => s.isTechnician);
  const { suppliers } = useSuppliers();
  const { machines } = useMachineOptions();
  // Look up the linked supplier's full profile so this card mirrors the
  // Suppliers page instead of the handful of fields snapshotted onto the
  // part at creation time. Falls back to a name match for parts saved
  // before supplierId existed.
  const supplier = part.supplierId
    ? suppliers.find((s) => s.id === part.supplierId)
    : suppliers.find((s) => s.name.trim().toLowerCase() === part.supplierName.trim().toLowerCase());

  const createdDate = tsToDate(part.createdAt as unknown as { toDate?: () => Date; seconds?: number });
  const updatedDate = tsToDate(part.updatedAt as unknown as { toDate?: () => Date; seconds?: number });
  const lastPurchaseDate = tsToDate(part.lastPurchaseDate as unknown as { toDate?: () => Date; seconds?: number });
  const lastReceivedDate = tsToDate(part.lastReceivedAt as unknown as { toDate?: () => Date; seconds?: number });
  const lastIssuedDate = tsToDate(part.lastIssuedAt as unknown as { toDate?: () => Date; seconds?: number });

  const available = Math.max(0, part.currentStock - part.reservedStock);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Part Details */}
      <Card title="Part Details">
        {part.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{part.description}</p>
        )}
        <Row label="Brand" value={part.brand} />
        <Row label="Model Ref." value={part.modelRef} />
        {part.warrantyMonths > 0 && (
          <Row label="Warranty" value={`${part.warrantyMonths} months`} />
        )}
        {part.notes && (
          <div className="text-sm">
            <p className="text-gray-500 mb-1">Notes</p>
            <p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{part.notes}</p>
          </div>
        )}
        {createdDate && <Row label="Created" value={formatDate(createdDate)} />}
        {updatedDate && <Row label="Updated" value={formatDistanceToNow(updatedDate)} />}
      </Card>

      {/* Location & Storage */}
      <Card title="Location & Storage">
        <div className="text-center py-2">
          <p className="text-xs text-gray-500 mb-1">Store Location</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">{part.storeLocation || ''}</p>
        </div>
        {part.compatibleMachineIds.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Compatible Machines</p>
            <div className="flex flex-wrap gap-1.5">
              {part.compatibleMachineIds.map((id) => {
                const machine = machines.find((m) => m.id === id);
                return (
                  <Link
                    key={id}
                    to={`/app/machines/${id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200"
                  >
                    <Cpu className="w-3 h-3" />
                    {machine?.name ?? id}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Supplier Info — mirrors the supplier's own profile on the Suppliers page */}
      <Card title="Supplier Info">
        <Row label="Supplier" value={supplier?.name || part.supplierName} />
        <Row label="Supplier Code" value={supplier?.supplierCode} />
        <Row label="Contact Person" value={supplier?.contactPerson} />
        <Row label="Phone" value={supplier?.phone || (part.supplierContact && !part.supplierContact.includes('@') ? part.supplierContact : '')} />
        <Row label="Email" value={supplier?.email || (part.supplierContact.includes('@') ? part.supplierContact : '')} />
        <Row label="Address" value={supplier?.address} />
        <Row label="Country" value={supplier?.country} />
        <Row
          label="Website"
          value={
            supplier?.website ? (
              <a href={supplier.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                {supplier.website}
              </a>
            ) : null
          }
        />
        <Row label="Payment Method" value={supplier?.paymentMethod} />
        <Row label="Bank Details" value={supplier?.bankDetails} />
        <Row label="Supplier Part Code" value={part.supplierPartCode} />
        <Row label="Lead Time" value={part.leadTimeDays ? `${part.leadTimeDays} days` : null} />
        {lastPurchaseDate && <Row label="Last Purchase" value={formatDate(lastPurchaseDate)} />}
        {(() => {
          const phone = supplier?.phone || (!part.supplierContact.includes('@') ? part.supplierContact : '');
          const email = supplier?.email || (part.supplierContact.includes('@') ? part.supplierContact : '');
          if (phone) {
            return (
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </a>
            );
          }
          if (email) {
            return (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-1">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </a>
            );
          }
          return null;
        })()}
      </Card>

      {/* Stock Levels */}
      <Card title="Stock Levels">
        <StockGauge
          current={part.currentStock}
          min={part.minStockLevel}
          max={part.maxStockLevel}
          unit={part.unit}
        />
        <div className="grid grid-cols-3 gap-3 mt-3 text-center text-xs">
          <div>
            <p className="text-gray-500">Current</p>
            <p className="font-bold text-gray-900"><UnitLabel unit={part.unit} quantity={part.currentStock} /></p>
          </div>
          <div>
            <p className="text-gray-500">Reserved</p>
            <p className="font-bold text-gray-700"><UnitLabel unit={part.unit} quantity={part.reservedStock} /></p>
          </div>
          <div>
            <p className="text-gray-500">Available</p>
            <p className="font-bold text-green-700"><UnitLabel unit={part.unit} quantity={available} /></p>
          </div>
        </div>
        {lastReceivedDate && <Row label="Last Received" value={formatDistanceToNow(lastReceivedDate)} />}
        {lastIssuedDate && <Row label="Last Issued" value={formatDistanceToNow(lastIssuedDate)} />}
      </Card>

      {/* Cost Summary — hidden from technician */}
      {!isTechnician && (
        <Card title="Cost Summary">
          <Row label="Unit Cost" value={<CostDisplay amount={part.unitCost} />} />
          <Row label="Last Purchase Price" value={<CostDisplay amount={part.lastPurchasePrice} />} />
          <Row
            label="Total Stock Value"
            value={<span className="text-blue-700 font-semibold">{formatLKR(part.unitCost * part.currentStock)}</span>}
          />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <Row label="Total Used (All Time)" value={<UnitLabel unit={part.unit} quantity={part.totalUsedAllTime} />} />
            <Row label="Total Cost (All Time)" value={<CostDisplay amount={part.totalCostAllTime} />} />
          </div>
        </Card>
      )}
    </div>
  );
}
