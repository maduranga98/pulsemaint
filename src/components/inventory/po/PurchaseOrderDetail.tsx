import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, XCircle, CheckCircle2, FileText, Send, Upload, Paperclip } from 'lucide-react';
import { updateDoc, doc, serverTimestamp, addDoc, collection, getDocs, query, where, arrayUnion, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/types/inventory';
import { openPOPrintView } from '@/lib/inventory/poPrintView';

interface PurchaseOrderDetailProps {
  order: PurchaseOrder;
}

const statusConfig: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  pending_approval: { label: 'Pending Approval', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  invoice_received: { label: 'Invoice Received', cls: 'bg-purple-100 text-purple-700' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-cyan-100 text-cyan-700' },
  received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  partially_received: { label: 'Partially Received', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
};

const TIMELINE_STEPS: { key: keyof PurchaseOrder; label: string }[] = [
  { key: 'raisedAt', label: 'Raised' },
  { key: 'sentAt', label: 'Sent' },
  { key: 'invoiceReceivedAt', label: 'Invoice Received' },
  { key: 'acknowledgedAt', label: 'Acknowledged' },
  { key: 'receivedAt', label: 'Received' },
];

function formatDate(ts: PurchaseOrder['raisedAt'] | null | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString();
}

export function PurchaseOrderDetail({ order }: PurchaseOrderDetailProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const role = userProfile?.role ?? '';
  const canApprove = ['plant_manager', 'admin', 'supervisor', 'maintenance_supervisor'].includes(role);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [reviewCosts, setReviewCosts] = useState<Record<string, number> | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const sc = statusConfig[order.status];

  async function queueEmail(event: PurchaseOrderStatus | 'invoice_priced', message?: string, override?: { total: number }) {
    try {
      const usersSnap = await getDocs(
        query(collection(db, `companies/${order.companyId}/users`), where('role', 'in', ['plant_manager', 'admin'])),
      );
      const recipients = usersSnap.docs
        .map((d) => (d.data() as any).email as string | undefined)
        .filter(Boolean) as string[];
      const supplierFacing = event === 'sent' || event === 'invoice_priced';
      if (recipients.length === 0 && !(order.supplierEmail && supplierFacing)) return;
      await addDoc(collection(db, 'po_notifications'), {
        companyId: order.companyId,
        poId: order.id,
        poNumber: order.poNumber,
        supplierName: order.supplierName,
        supplierEmail: order.supplierEmail ?? '',
        total: override?.total ?? order.totalOrderValue,
        currency: order.currency,
        recipients,
        event,
        message: message ?? '',
        status: 'queued',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to queue PO email notification', err);
    }
  }

  async function approve() {
    if (!userProfile) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'approved',
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('approved');
      addToast('Purchase order approved.', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? `Failed to approve PO: ${err.message}` : 'Failed to approve PO.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function reject() {
    if (!userProfile) return;
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (!reason) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'rejected',
        rejectedReason: reason,
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('rejected');
      addToast('Purchase order rejected.', 'success');
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? `Failed to reject PO: ${err.message}` : 'Failed to reject PO.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function markAcknowledged() {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'acknowledged',
        acknowledgedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('acknowledged');
      addToast('Supplier acknowledgement recorded.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update PO.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitForApproval() {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'pending_approval',
        updatedAt: serverTimestamp(),
      });
      await queueEmail('pending_approval');
      addToast('Purchase order submitted for approval.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to submit PO for approval.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function markSent() {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('sent', sendMessage);
      addToast('PO sent to supplier.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to update PO.', 'error');
    } finally {
      setActionLoading(false);
      setSendModal(false);
      setSendMessage('');
    }
  }

  // The first invoice received against a "sent" PO advances the status and
  // opens the review/pricing step. A renewed invoice attached later (after
  // the PO has already been resent with revised pricing, or at any later
  // stage) is just a new attachment on the existing record — the status and
  // pricing are updated separately, via Review Invoice.
  const isInitialInvoice = order.status === 'sent';

  async function submitInvoice() {
    if (!invoiceFile || !userProfile) return;
    setUploadingInvoice(true);
    try {
      const path = `companies/${order.companyId}/purchaseOrders/${order.id}/invoice/${Date.now()}_${invoiceFile.name}`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, invoiceFile);
      const url = await getDownloadURL(sref);
      const attachmentLabel = isInitialInvoice ? `Invoice - ${invoiceFile.name}` : `Renewed Invoice - ${invoiceFile.name}`;
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        ...(isInitialInvoice ? { status: 'invoice_received', invoiceReceivedAt: serverTimestamp() } : {}),
        invoiceUploadedBy: userProfile.id,
        invoiceUploadedByName: userProfile.fullName ?? '',
        attachments: arrayUnion({ name: attachmentLabel, url }),
        updatedAt: serverTimestamp(),
      });
      if (isInitialInvoice) await queueEmail('invoice_received');
      addToast(isInitialInvoice ? 'Invoice submitted. Review it to confirm pricing.' : 'Renewed invoice attached.', 'success');
      setInvoiceModal(false);
      setInvoiceFile(null);
    } catch (err) {
      console.error(err);
      addToast('Failed to submit invoice.', 'error');
    } finally {
      setUploadingInvoice(false);
    }
  }

  function openReview() {
    const initial: Record<string, number> = {};
    order.items.forEach((it) => { initial[it.id] = it.unitCost; });
    setReviewCosts(initial);
  }

  // Confirms the invoice-derived prices (whether left as-is or edited) and
  // sends a fresh priced PO email to the supplier. Re-runnable any number of
  // times — every save is a new "invoice revision" with its own email, which
  // is how a later price correction gets communicated too.
  async function savePricedPO() {
    if (!reviewCosts || !userProfile) return;
    setReviewSaving(true);
    try {
      const updatedItems: PurchaseOrderItem[] = order.items.map((it) => {
        const unitCost = reviewCosts[it.id] ?? it.unitCost;
        return { ...it, unitCost, totalCost: unitCost * it.quantityOrdered };
      });
      const totalOrderValue = updatedItems.reduce((sum, it) => sum + it.totalCost, 0);
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        items: updatedItems,
        totalOrderValue,
        invoiceRevisions: arrayUnion({
          revisedAt: Timestamp.now(),
          revisedBy: userProfile.id,
          revisedByName: userProfile.fullName ?? '',
          items: updatedItems.map((it) => ({
            partId: it.partId,
            partNumber: it.partNumber,
            partName: it.partName,
            unitCost: it.unitCost,
            totalCost: it.totalCost,
          })),
          totalOrderValue,
        }),
        updatedAt: serverTimestamp(),
      });
      // Prices are only known once the supplier's invoice is reviewed — carry
      // the confirmed unit cost onto each part's profile as its last
      // purchase price, so the next PO for that part prefills sensibly.
      await Promise.all(
        updatedItems
          .filter((it) => it.partId)
          .map((it) =>
            updateDoc(doc(db, 'inventoryParts', it.partId), {
              lastPurchasePrice: it.unitCost,
              lastPurchaseDate: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => console.error(`Failed to update last purchase price for part ${it.partId}`, err)),
          ),
      );
      await queueEmail('invoice_priced', undefined, { total: totalOrderValue });
      addToast('Priced PO sent to supplier.', 'success');
      setReviewCosts(null);
    } catch (err) {
      console.error(err);
      addToast('Failed to save invoice pricing.', 'error');
    } finally {
      setReviewSaving(false);
    }
  }

  function downloadPdf() {
    openPOPrintView(order, {
      name: company?.name ?? 'Company',
      address: (company as any)?.address,
      phone: (company as any)?.phone,
      email: (company as any)?.email,
    });
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      addToast('Purchase order cancelled.', 'success');
      setCancelModal(false);
    } catch {
      addToast('Failed to cancel PO.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  const grandTotal = order.items.reduce((sum, it) => sum + it.totalCost, 0);
  const outstanding = order.items.reduce(
    (sum, it) => sum + Math.max(0, it.quantityOrdered - it.quantityReceived) * it.unitCost,
    0
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-[Sora]">{order.poNumber}</h2>
            <p className="text-gray-600 mt-0.5">{order.supplierName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Timeline</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {TIMELINE_STEPS.map((step, idx) => {
              const ts = order[step.key] as PurchaseOrder['raisedAt'] | null;
              const done = !!ts;
              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center gap-1`}>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap">{step.label}</span>
                    {done && <span className="text-xs text-gray-400">{formatDate(ts)}</span>}
                  </div>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <div className={`h-0.5 w-8 mb-8 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Order Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Part</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Ordered</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Received</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Outstanding</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Unit Cost</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item) => {
                  const outstandingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-mono text-gray-700 text-xs">{item.partNumber}</p>
                        <p className="text-gray-900 font-medium">{item.partName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.quantityOrdered}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{item.quantityReceived}</td>
                      <td className="px-4 py-3">
                        <span className={outstandingQty > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}>
                          {outstandingQty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {order.currency} {item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-semibold whitespace-nowrap">
                        {order.currency} {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Totals footer */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-6 justify-end text-sm">
            <div className="text-right">
              <p className="text-gray-500">Outstanding</p>
              <p className="font-bold text-amber-700">
                {order.currency} {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Grand Total</p>
              <p className="font-bold text-gray-900 text-lg">
                {order.currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Receipt history — every "Confirm Receipt" submission against this PO */}
        {order.receiptHistory && order.receiptHistory.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Receipt History</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {order.receiptHistory.map((r, i) => (
                <li key={i} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{r.deliveryRef || 'No delivery reference'}</span>
                    <span className="text-xs text-gray-500">{formatDate(r.receivedAt)} · {r.receivedByName}</span>
                  </div>
                  {r.notes && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{r.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invoice attachments */}
        {order.attachments && order.attachments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Attachments</h3>
            <ul className="space-y-1.5">
              {order.attachments.map((att, i) => (
                <li key={i}>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {att.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {order.status === 'received' && (
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              Download / Print PDF
            </button>
          )}

          {(order.status === 'draft' || order.status === 'pending_approval') && (
            <button
              onClick={() => navigate(`/app/inventory/purchase-orders/${order.id}/edit`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              Edit PO
            </button>
          )}

          {order.status === 'draft' && (
            <button
              onClick={submitForApproval}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </button>
          )}

          {canApprove && order.status === 'pending_approval' && (
            <>
              <button
                onClick={approve}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={reject}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}

          {order.status === 'approved' && (
            <button
              onClick={() => setSendModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              Send to Supplier
            </button>
          )}

          {order.status === 'sent' && (
            <button
              onClick={() => setInvoiceModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              Submit Received Invoice
            </button>
          )}

          {(order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received' || order.status === 'received') && !reviewCosts && (
            <button
              onClick={openReview}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              Review Invoice &amp; Send Priced PO
            </button>
          )}

          {order.status === 'invoice_received' && (
            <button
              onClick={markAcknowledged}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark as Acknowledged
            </button>
          )}

          {/* After the PO has been resent with revised pricing (or at any
              later stage), the supplier may come back with an updated
              invoice — attach it here without resetting the PO's status. */}
          {(order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received' || order.status === 'received') && (
            <button
              onClick={() => setInvoiceModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              Attach Renewed Invoice
            </button>
          )}

          {(order.status === 'sent' || order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received') && (
            <button
              onClick={() => navigate(`/app/inventory/receive?poId=${order.id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <PackageCheck className="w-4 h-4" />
              Mark as Received
            </button>
          )}
          {order.status !== 'received' && order.status !== 'cancelled' && (
            <button
              onClick={() => setCancelModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* Send to supplier — optional message body */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Send PO to {order.supplierName || 'Supplier'}</h3>
            <p className="text-sm text-gray-600">
              An email with the PO details will be sent to{' '}
              <strong>{order.supplierEmail || 'the supplier (no email on file)'}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a note for the supplier…"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSendModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={markSent}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {actionLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit received invoice */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{isInitialInvoice ? 'Submit Received Invoice' : 'Attach Renewed Invoice'}</h3>
            <p className="text-sm text-gray-600">
              {isInitialInvoice
                ? <>Attach the invoice the supplier sent for <strong>{order.poNumber}</strong>. You'll review and confirm its pricing next.</>
                : <>Attach an updated invoice from the supplier for <strong>{order.poNumber}</strong>. Use Review Invoice &amp; Send Priced PO to apply any new pricing from it.</>}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice file</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:text-sm file:font-medium hover:file:bg-purple-100"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setInvoiceModal(false); setInvoiceFile(null); }}
                disabled={uploadingInvoice}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitInvoice}
                disabled={uploadingInvoice || !invoiceFile}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {uploadingInvoice ? 'Uploading…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review invoice pricing — accept as-is or edit, then send priced PO */}
      {reviewCosts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">Review Invoice Pricing</h3>
            <p className="text-sm text-gray-600">
              Enter the unit cost from the supplier's invoice for each item — pre-filled with the current PO price.
              Sending will email the supplier the finalized priced PO. You can come back and revise again later if the price changes.
            </p>
            <div className="space-y-3">
              {order.items.map((it) => (
                <div key={it.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{it.partName}</p>
                  <p className="font-mono text-xs text-gray-500 mb-2">{it.partNumber} · Qty {it.quantityOrdered}</p>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost ({order.currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewCosts[it.id] ?? it.unitCost}
                    onChange={(e) =>
                      setReviewCosts((prev) => ({ ...(prev ?? {}), [it.id]: Math.max(0, parseFloat(e.target.value) || 0) }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setReviewCosts(null)}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={savePricedPO}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {reviewSaving ? 'Sending…' : 'Confirm & Send Priced PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cancel Purchase Order?</h3>
            <p className="text-sm text-gray-600">
              This purchase order will be marked as cancelled and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Keep PO
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
