import { useState } from 'react';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';
import type { Timestamp } from 'firebase/firestore';
import {
  ExternalLink,
  ShieldOff,
  Award,
  Loader2,
  X,
} from 'lucide-react';

interface CertificatesManagerProps {
  certificates: TrainingCertificate[];
  loading: boolean;
  onRevoke: (id: string, reason: string) => Promise<void>;
}

type ExpiryFilter = 'all' | 'valid' | 'expired' | 'expiring-soon';

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const EXPIRING_SOON_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isExpiringSoon(ts: Timestamp | null): boolean {
  if (!ts) return false;
  const expiryMs = (ts as unknown as { seconds: number }).seconds * 1000;
  const now = Date.now();
  return expiryMs > now && expiryMs - now <= EXPIRING_SOON_DAYS * MS_PER_DAY;
}

function isExpired(ts: Timestamp | null): boolean {
  if (!ts) return false;
  const expiryMs = (ts as unknown as { seconds: number }).seconds * 1000;
  return expiryMs < Date.now();
}

export default function CertificatesManager({
  certificates,
  loading,
  onRevoke,
}: CertificatesManagerProps) {
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [showRevoked, setShowRevoked] = useState(false);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const filtered = certificates.filter((cert) => {
    if (!showRevoked && cert.isRevoked) return false;

    const matchSearch =
      !search.trim() ||
      cert.traineeName.toLowerCase().includes(search.toLowerCase()) ||
      cert.certificateNumber.toLowerCase().includes(search.toLowerCase());

    let matchExpiry = true;
    if (expiryFilter === 'valid') {
      matchExpiry = !isExpired(cert.expiryDate) && !cert.isExpired;
    } else if (expiryFilter === 'expired') {
      matchExpiry = cert.isExpired || isExpired(cert.expiryDate);
    } else if (expiryFilter === 'expiring-soon') {
      matchExpiry = isExpiringSoon(cert.expiryDate);
    }

    return matchSearch && matchExpiry;
  });

  async function handleRevoke() {
    if (!revokeTargetId) return;
    if (!revokeReason.trim()) {
      setRevokeError('Please provide a reason for revocation.');
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      await onRevoke(revokeTargetId, revokeReason.trim());
      setRevokeTargetId(null);
      setRevokeReason('');
    } catch (err) {
      setRevokeError(
        err instanceof Error ? err.message : 'Revocation failed'
      );
    } finally {
      setRevoking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          type="text"
          placeholder="Search trainee or cert #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Certificates</option>
          <option value="valid">Valid Only</option>
          <option value="expired">Expired</option>
          <option value="expiring-soon">Expiring Soon</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(e) => setShowRevoked(e.target.checked)}
            className="rounded"
          />
          Show Revoked
        </label>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 flex flex-col items-center text-gray-400 gap-2">
          <Award className="w-10 h-10" />
          <p className="text-sm">No certificates found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cert #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trainee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Machine</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Module</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Issued</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((cert) => {
                const expired = cert.isExpired || isExpired(cert.expiryDate);
                const expiringSoon = !expired && isExpiringSoon(cert.expiryDate);

                let statusLabel = 'Valid';
                let statusClass = 'bg-green-100 text-green-700';
                if (cert.isRevoked) {
                  statusLabel = 'Revoked';
                  statusClass = 'bg-gray-200 text-gray-600';
                } else if (expired) {
                  statusLabel = 'Expired';
                  statusClass = 'bg-red-100 text-red-700';
                } else if (expiringSoon) {
                  statusLabel = 'Expiring Soon';
                  statusClass = 'bg-amber-100 text-amber-700';
                }

                return (
                  <tr
                    key={cert.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {cert.certificateNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cert.traineeName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cert.machineName || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cert.moduleName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatTs(cert.issuedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatTs(cert.expiryDate)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900 font-medium">
                      {cert.quizScore}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {cert.pdfUrl && (
                          <a
                            href={cert.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            PDF
                          </a>
                        )}
                        {!cert.isRevoked && (
                          <button
                            onClick={() => {
                              setRevokeTargetId(cert.id);
                              setRevokeReason('');
                              setRevokeError(null);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          >
                            <ShieldOff className="w-3 h-3" />
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Revoke Certificate
              </h3>
              <button
                onClick={() => setRevokeTargetId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              This will permanently revoke the certificate. The trainee will
              need to be reassigned to regain certification.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Explain why this certificate is being revoked..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            {revokeError && (
              <p className="text-sm text-red-600">{revokeError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRevokeTargetId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {revoking && <Loader2 className="w-3 h-3 animate-spin" />}
                Revoke Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
