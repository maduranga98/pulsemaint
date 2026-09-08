import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

const statusClsConfig: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  sent: 'bg-blue-100 text-blue-700',
  invoice_received: 'bg-purple-100 text-purple-700',
  acknowledged: 'bg-cyan-100 text-cyan-700',
  received: 'bg-green-100 text-green-700',
  partially_received: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
};

function statusLabel(status: PurchaseOrderStatus, t: TFunction): string {
  return t(`common.inventory.po.statuses.${status}`);
}

function timelineSteps(t: TFunction): { key: keyof PurchaseOrder; label: string }[] {
  return [
    { key: 'raisedAt', label: t('common.inventory.po.detail.timeline.steps.raised') },
    { key: 'sentAt', label: t('common.inventory.po.detail.timeline.steps.sent') },
    { key: 'invoiceReceivedAt', label: t('common.inventory.po.detail.timeline.steps.invoiceReceived') },
    { key: 'acknowledgedAt', label: t('common.inventory.po.detail.timeline.steps.acknowledged') },
    { key: 'receivedAt', label: t('common.inventory.po.detail.timeline.steps.received') },
  ];
}

function formatDate(ts: PurchaseOrder['raisedAt'] | null | undefined): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString();
}

function formatDateTime(ts: unknown): string {
  if (!ts) return '';
  const t = ts as { toDate?: () => Date; seconds?: number };
  const d = t.toDate ? t.toDate() : t.seconds ? new Date(t.seconds * 1000) : null;
  return d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
}

interface ProcessHistoryEvent {
  label: string;
  at: unknown;
  detail?: string;
}

function buildProcessHistory(order: PurchaseOrder, t: TFunction): ProcessHistoryEvent[] {
  const events: ProcessHistoryEvent[] = [];
  if (order.raisedAt) {
    events.push({ label: t('common.inventory.po.detail.history.events.raised'), at: order.raisedAt, detail: order.raisedByName || undefined });
  }
  if (order.status === 'rejected' && order.approvedAt) {
    events.push({
      label: t('common.inventory.po.detail.history.events.rejected'),
      at: order.approvedAt,
      detail: [order.approvedByName, order.rejectedReason].filter(Boolean).join(' — ') || undefined,
    });
  } else if (order.approvedAt) {
    events.push({
      label: t('common.inventory.po.detail.history.events.approved'),
      at: order.approvedAt,
      detail: order.approvedByName
        ? `${order.approvedByName}${order.approvedByRole ? ` (${order.approvedByRole})` : ''}`
        : undefined,
    });
  }
  if (order.sentAt) {
    events.push({ label: t('common.inventory.po.detail.history.events.sentToSupplier'), at: order.sentAt });
  }
  if (order.invoiceReceivedAt) {
    events.push({ label: t('common.inventory.po.detail.history.events.invoiceReceived'), at: order.invoiceReceivedAt, detail: order.invoiceUploadedByName || undefined });
  }
  (order.invoiceRevisions ?? []).forEach((rev, idx) => {
    events.push({
      label:
        (order.invoiceRevisions?.length ?? 0) > 1
          ? t('common.inventory.po.detail.history.events.pricedPoSentRevision', { number: idx + 1 })
          : t('common.inventory.po.detail.history.events.pricedPoSent'),
      at: rev.revisedAt,
      detail: `${rev.revisedByName} — ${rev.totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`,
    });
  });
  if (order.acknowledgedAt) {
    events.push({ label: t('common.inventory.po.detail.history.events.acknowledged'), at: order.acknowledgedAt });
  }
  (order.receiptHistory ?? []).forEach((r) => {
    events.push({
      label: t('common.inventory.po.detail.history.events.stockReceived'),
      at: r.receivedAt,
      detail: [r.receivedByName, r.deliveryRef].filter(Boolean).join(' — ') || undefined,
    });
  });
  if (order.cancelledAt) {
    events.push({
      label: t('common.inventory.po.detail.history.events.cancelled'),
      at: order.cancelledAt,
      detail: [order.cancelledByName, order.cancelledReason].filter(Boolean).join(' — ') || undefined,
    });
  }
  return events.filter((e) => e.at);
}

export function PurchaseOrderDetail({ order }: PurchaseOrderDetailProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const role = userProfile?.role ?? '';
  const canApprove = ['plant_manager', 'admin', 'supervisor', 'maintenance_supervisor'].includes(role);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [reviewCosts, setReviewCosts] = useState<Record<string, number> | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const scCls = statusClsConfig[order.status];

  async function queueEmail(event: PurchaseOrderStatus | 'invoice_priced', message?: string, override?: { total: number }): Promise<boolean> {
    try {
      const usersSnap = await getDocs(
        query(collection(db, `companies/${order.companyId}/users`), where('role', 'in', ['plant_manager', 'admin'])),
      );
      const recipients = usersSnap.docs
        .map((d) => (d.data() as any).email as string | undefined)
        .filter(Boolean) as string[];
      const supplierFacing = event === 'sent' || event === 'invoice_priced' || event === 'cancelled';
      if (recipients.length === 0 && !(order.supplierEmail && supplierFacing)) return true;
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
      return true;
    } catch (err) {
      console.error('Failed to queue PO email notification', err);
      return false;
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
        approvedByRole: userProfile.role ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('approved');
      addToast(t('common.inventory.po.detail.toasts.approved'), 'success');
    } catch (err) {
      console.error(err);
      addToast(
        err instanceof Error
          ? t('common.inventory.po.detail.toasts.approveFailed', { message: err.message })
          : t('common.inventory.po.detail.toasts.approveFailedGeneric'),
        'error',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function reject() {
    if (!userProfile) return;
    const reason = window.prompt(t('common.inventory.po.detail.toasts.rejectPrompt')) ?? '';
    if (!reason) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'rejected',
        rejectedReason: reason,
        approvedBy: userProfile.id,
        approvedByName: userProfile.fullName ?? '',
        approvedByRole: userProfile.role ?? '',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await queueEmail('rejected');
      addToast(t('common.inventory.po.detail.toasts.rejected'), 'success');
    } catch (err) {
      console.error(err);
      addToast(
        err instanceof Error
          ? t('common.inventory.po.detail.toasts.rejectFailed', { message: err.message })
          : t('common.inventory.po.detail.toasts.rejectFailedGeneric'),
        'error',
      );
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
      addToast(t('common.inventory.po.detail.toasts.acknowledgedRecorded'), 'success');
    } catch (err) {
      console.error(err);
      addToast(t('common.inventory.po.detail.toasts.updateFailed'), 'error');
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
      addToast(t('common.inventory.po.detail.toasts.submittedForApproval'), 'success');
    } catch (err) {
      console.error(err);
      addToast(t('common.inventory.po.detail.toasts.submitForApprovalFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function markSent() {
    if (!order.supplierEmail?.trim()) {
      addToast(t('common.inventory.po.detail.toasts.missingSupplierEmail'), 'error');
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const queued = await queueEmail('sent', sendMessage);
      if (queued) {
        addToast(t('common.inventory.po.detail.toasts.sentToSupplier'), 'success');
      } else {
        addToast(t('common.inventory.po.detail.toasts.sentButEmailFailed'), 'error');
      }
    } catch (err) {
      console.error(err);
      addToast(t('common.inventory.po.detail.toasts.updateFailed'), 'error');
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
      addToast(
        isInitialInvoice
          ? t('common.inventory.po.detail.toasts.invoiceSubmitted')
          : t('common.inventory.po.detail.toasts.invoiceRenewed'),
        'success',
      );
      setInvoiceModal(false);
      setInvoiceFile(null);
    } catch (err) {
      console.error(err);
      addToast(t('common.inventory.po.detail.toasts.invoiceSubmitFailed'), 'error');
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
      const queued = await queueEmail('invoice_priced', reviewMessage.trim(), { total: totalOrderValue });
      addToast(
        queued
          ? t('common.inventory.po.detail.toasts.pricedPoSent')
          : t('common.inventory.po.detail.toasts.pricedPoSavedEmailFailed'),
        queued ? 'success' : 'error',
      );
      setReviewCosts(null);
      setReviewMessage('');
    } catch (err) {
      console.error(err);
      addToast(t('common.inventory.po.detail.toasts.pricingSaveFailed'), 'error');
    } finally {
      setReviewSaving(false);
    }
  }

  function downloadPdf() {
    openPOPrintView(
      order,
      {
        name: company?.name ?? 'Company',
        address: (company as any)?.address,
        phone: (company as any)?.phone,
        email: (company as any)?.email,
      },
      {
        approver: order.approvedByName
          ? { name: order.approvedByName, role: order.approvedByRole ?? undefined }
          : undefined,
        generatedAt: new Date(),
      },
    );
  }

  // Once a PO has been sent to the supplier, cancelling it needs to tell
  // them why — they may already be preparing or shipping the order.
  const wasSentToSupplier = Boolean(order.sentAt);

  async function handleCancel() {
    if (!userProfile) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'purchaseOrders', order.id), {
        status: 'cancelled',
        cancelledBy: userProfile.id,
        cancelledByName: userProfile.fullName ?? '',
        cancelledAt: serverTimestamp(),
        cancelledReason: cancelReason.trim() || null,
        updatedAt: serverTimestamp(),
      });
      if (wasSentToSupplier) await queueEmail('cancelled', cancelReason.trim());
      addToast(t('common.inventory.po.detail.toasts.cancelled'), 'success');
      setCancelModal(false);
      setCancelReason('');
    } catch {
      addToast(t('common.inventory.po.detail.toasts.cancelFailed'), 'error');
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
            <h2 className="text-2xl font-bold text-gray-900">{order.poNumber}</h2>
            <p className="text-gray-600 mt-0.5">{order.supplierName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${scCls}`}>
              {statusLabel(order.status, t)}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">{t('common.inventory.po.detail.timeline.title')}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const steps = timelineSteps(t);
              return steps.map((step, idx) => {
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
                    {idx < steps.length - 1 && (
                      <div className={`h-0.5 w-8 mb-8 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Process History */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">{t('common.inventory.po.detail.history.title')}</h3>
          {(() => {
            const history = buildProcessHistory(order, t).sort((a, b) => {
              const toMillis = (ts: unknown) => {
                const t = ts as { toDate?: () => Date; seconds?: number };
                return t.toDate ? t.toDate().getTime() : t.seconds ? t.seconds * 1000 : 0;
              };
              return toMillis(a.at) - toMillis(b.at);
            });
            if (history.length === 0) {
              return <p className="text-sm text-gray-400">{t('common.inventory.po.detail.history.empty')}</p>;
            }
            return (
              <ul className="space-y-3">
                {history.map((event, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{event.label}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(event.at)}</span>
                      </div>
                      {event.detail && <p className="text-xs text-gray-500">{event.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>

        {/* Items table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('common.inventory.po.detail.items.title')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">{t('common.inventory.po.detail.items.columns.part')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.detail.items.columns.ordered')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.detail.items.columns.received')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.detail.items.columns.outstanding')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.detail.items.columns.unitCost')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.po.detail.items.columns.total')}</th>
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
              <p className="text-gray-500">{t('common.inventory.po.detail.items.outstandingLabel')}</p>
              <p className="font-bold text-amber-700">
                {order.currency} {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">{t('common.inventory.po.detail.items.grandTotalLabel')}</p>
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
              <h3 className="font-semibold text-gray-900">{t('common.inventory.po.detail.receiptHistory.title')}</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {order.receiptHistory.map((r, i) => (
                <li key={i} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{r.deliveryRef || t('common.inventory.po.detail.receiptHistory.noDeliveryRef')}</span>
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
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t('common.inventory.po.detail.attachments.title')}</h3>
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
            <h3 className="font-semibold text-gray-900 mb-2 text-sm">{t('common.inventory.po.detail.notes.title')}</h3>
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
              {t('common.inventory.po.detail.actions.downloadPdf')}
            </button>
          )}

          {(order.status === 'draft' || order.status === 'pending_approval') && (
            <button
              onClick={() => navigate(`/app/inventory/purchase-orders/${order.id}/edit`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.editPo')}
            </button>
          )}

          {order.status === 'draft' && (
            <button
              onClick={submitForApproval}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.submitForApproval')}
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
                {t('common.inventory.po.detail.actions.approve')}
              </button>
              <button
                onClick={reject}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                <XCircle className="w-4 h-4" />
                {t('common.inventory.po.detail.actions.reject')}
              </button>
            </>
          )}

          {order.status === 'approved' && (
            <button
              onClick={() => setSendModal(true)}
              disabled={actionLoading}
              title={!order.supplierEmail?.trim() ? t('common.inventory.po.detail.actions.sendToSupplierDisabledTitle') : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.sendToSupplier')}
            </button>
          )}

          {order.status === 'sent' && (
            <button
              onClick={() => setInvoiceModal(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.submitReceivedInvoice')}
            </button>
          )}

          {(order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received' || order.status === 'received') && !reviewCosts && (
            <button
              onClick={openReview}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.reviewInvoiceAndSend')}
            </button>
          )}

          {order.status === 'invoice_received' && (
            <button
              onClick={markAcknowledged}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.markAcknowledged')}
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
              {t('common.inventory.po.detail.actions.attachRenewedInvoice')}
            </button>
          )}

          {(order.status === 'sent' || order.status === 'invoice_received' || order.status === 'acknowledged' || order.status === 'partially_received') && (
            <button
              onClick={() => navigate(`/app/inventory/receive?poId=${order.id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <PackageCheck className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.markAsReceived')}
            </button>
          )}
          {order.status !== 'received' && order.status !== 'cancelled' && (
            <button
              onClick={() => setCancelModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              {t('common.inventory.po.detail.actions.cancelPo')}
            </button>
          )}
        </div>
      </div>

      {/* Send to supplier — optional message body */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {t('common.inventory.po.detail.sendModal.title', {
                supplierName: order.supplierName || t('common.inventory.po.detail.sendModal.defaultSupplier'),
              })}
            </h3>
            <p className="text-sm text-gray-600">
              <Trans
                i18nKey="common.inventory.po.detail.sendModal.description"
                values={{ email: order.supplierEmail || t('common.inventory.po.detail.sendModal.noEmailOnFile') }}
                components={{ 1: <strong /> }}
              />
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.inventory.po.detail.sendModal.messageLabel')}</label>
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('common.inventory.po.detail.sendModal.messagePlaceholder')}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSendModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.inventory.po.detail.sendModal.cancel')}
              </button>
              <button
                onClick={markSent}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {actionLoading ? t('common.inventory.po.detail.sendModal.sending') : t('common.inventory.po.detail.sendModal.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit received invoice */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {isInitialInvoice
                ? t('common.inventory.po.detail.invoiceModal.titleSubmit')
                : t('common.inventory.po.detail.invoiceModal.titleRenew')}
            </h3>
            <p className="text-sm text-gray-600">
              {isInitialInvoice ? (
                <Trans
                  i18nKey="common.inventory.po.detail.invoiceModal.descriptionInitial"
                  values={{ poNumber: order.poNumber }}
                  components={{ 1: <strong /> }}
                />
              ) : (
                <Trans
                  i18nKey="common.inventory.po.detail.invoiceModal.descriptionRenewal"
                  values={{ poNumber: order.poNumber }}
                  components={{ 1: <strong /> }}
                />
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.inventory.po.detail.invoiceModal.fileLabel')}</label>
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
                {t('common.inventory.po.detail.invoiceModal.cancel')}
              </button>
              <button
                onClick={submitInvoice}
                disabled={uploadingInvoice || !invoiceFile}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {uploadingInvoice ? t('common.inventory.po.detail.invoiceModal.uploading') : t('common.inventory.po.detail.invoiceModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review invoice pricing — accept as-is or edit, then send priced PO */}
      {reviewCosts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900">{t('common.inventory.po.detail.reviewModal.title')}</h3>
            <p className="text-sm text-gray-600">
              {t('common.inventory.po.detail.reviewModal.description')}
            </p>
            <div className="space-y-3">
              {order.items.map((it) => (
                <div key={it.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{it.partName}</p>
                  <p className="font-mono text-xs text-gray-500 mb-2">
                    {it.partNumber} · {t('common.inventory.po.detail.reviewModal.qtyLabel', { count: it.quantityOrdered })}
                  </p>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {t('common.inventory.po.detail.reviewModal.unitCostLabel', { currency: order.currency })}
                  </label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.inventory.po.detail.reviewModal.messageLabel')}</label>
              <textarea
                value={reviewMessage}
                onChange={(e) => setReviewMessage(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('common.inventory.po.detail.reviewModal.messagePlaceholder')}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setReviewCosts(null); setReviewMessage(''); }}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.inventory.po.detail.reviewModal.cancel')}
              </button>
              <button
                onClick={savePricedPO}
                disabled={reviewSaving}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {reviewSaving ? t('common.inventory.po.detail.reviewModal.sending') : t('common.inventory.po.detail.reviewModal.confirmAndSend')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{t('common.inventory.po.detail.cancelModal.title')}</h3>
            <p className="text-sm text-gray-600">
              {t('common.inventory.po.detail.cancelModal.description')}
              {wasSentToSupplier && t('common.inventory.po.detail.cancelModal.descriptionSentNote')}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {wasSentToSupplier
                  ? t('common.inventory.po.detail.cancelModal.reasonLabelRequired')
                  : t('common.inventory.po.detail.cancelModal.reasonLabelOptional')}
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  wasSentToSupplier
                    ? t('common.inventory.po.detail.cancelModal.reasonPlaceholderRequired')
                    : t('common.inventory.po.detail.cancelModal.reasonPlaceholderOptional')
                }
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCancelModal(false); setCancelReason(''); }}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                {t('common.inventory.po.detail.cancelModal.keepPo')}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || (wasSentToSupplier && !cancelReason.trim())}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-60"
              >
                {cancelling ? t('common.inventory.po.detail.cancelModal.cancelling') : t('common.inventory.po.detail.cancelModal.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
