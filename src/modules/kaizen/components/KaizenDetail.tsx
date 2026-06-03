import { useState } from 'react';
import {
  X,
  ThumbsUp,
  MessageSquare,
  ArrowRight,
  Clock,
  Camera,
  Lock,
  AlertTriangle,
  PauseCircle,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/authStore';
import { useKaizenCard } from '../hooks/useKaizen';
import {
  transitionState,
  voteOnKaizen,
  addComment,
  uploadKaizenPhoto,
  calculateROI,
  getAvailableTransitions,
} from '../services/kaizen.service';
import {
  KAIZEN_STATUS_META,
  KAIZEN_CATEGORY_META,
  KAIZEN_PRIORITY_META,
} from '../types/kaizen.types';
import type { KaizenStatus } from '../types/kaizen.types';

interface Props {
  cardId: string;
  onClose: () => void;
  isProPlan?: boolean;
}

export function KaizenDetail({ cardId, onClose, isProPlan = false }: Props) {
  const plantId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const userId = useAuthStore((s) => s.userProfile?.id ?? '');
  const userName = useAuthStore((s) => s.userProfile?.fullName ?? '');
  const role = useAuthStore((s) => s.userProfile?.role ?? 'technician');

  const { card, loading } = useKaizenCard(cardId);

  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'roi'>('details');
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [onHoldReason, setOnHoldReason] = useState('');
  const [onHoldUntil, setOnHoldUntil] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [transitioning, setTransitioning] = useState<KaizenStatus | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (!card) return null;

  const statusMeta = KAIZEN_STATUS_META[card.status];
  const categoryMeta = KAIZEN_CATEGORY_META[card.category];
  const priorityMeta = KAIZEN_PRIORITY_META[card.priority];
  const hasVoted = card.votes.includes(userId);

  const availableTransitions = getAvailableTransitions(card.status, role);
  const mainTransitions = availableTransitions.filter(
    (s) => s !== 'REJECTED' && s !== 'ON_HOLD'
  );

  const canSeeInternal =
    role === 'admin' || role === 'supervisor' || role === 'plant_manager';
  const visibleComments = card.comments.filter(
    (c) => !c.isInternal || canSeeInternal
  );

  async function handleVote() {
    try {
      await voteOnKaizen(plantId, cardId, userId);
    } catch {
      toast.error('Failed to vote');
    }
  }

  async function handleTransition(to: KaizenStatus) {
    setTransitioning(to);
    try {
      await transitionState(plantId, cardId, to, transitionNotes, userId, userName, role);
      setTransitionNotes('');
      toast.success(`Status updated to ${KAIZEN_STATUS_META[to].label}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setTransitioning(null);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setTransitioning('REJECTED');
    try {
      await transitionState(
        plantId, cardId, 'REJECTED', transitionNotes, userId, userName, role,
        { rejectionReason }
      );
      setShowRejectForm(false);
      toast.success('Kaizen rejected');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setTransitioning(null);
    }
  }

  async function handleHold() {
    setTransitioning('ON_HOLD');
    try {
      await transitionState(
        plantId, cardId, 'ON_HOLD', transitionNotes, userId, userName, role,
        { onHoldReason, onHoldUntil }
      );
      setShowHoldForm(false);
      toast.success('Kaizen put on hold');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setTransitioning(null);
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addComment(plantId, cardId, {
        userId,
        userName,
        text: commentText,
        isInternal,
      });
      setCommentText('');
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      await uploadKaizenPhoto(file, plantId, cardId, 'after');
      toast.success('Photo uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  const roi = isProPlan ? calculateROI(card) : null;
  const daysSinceVerified = card.verifiedAt
    ? differenceInDays(new Date(), card.verifiedAt.toDate())
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch justify-end bg-black/50">
      <div className="bg-white w-full sm:w-[520px] h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs font-mono text-gray-400">#{cardId.slice(-6).toUpperCase()}</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: statusMeta.color, backgroundColor: statusMeta.bgColor }}
              >
                {statusMeta.label}
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color: priorityMeta.color, backgroundColor: priorityMeta.bgColor }}
              >
                {priorityMeta.label}
              </span>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 ml-2">
              <X size={18} />
            </button>
          </div>

          <h2 className="text-lg font-bold text-gray-900 leading-snug">{card.title}</h2>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
            <span
              className="font-medium"
              style={{ color: categoryMeta.color }}
            >
              {categoryMeta.icon} {categoryMeta.label}
            </span>
            {(card.machineName ?? card.area) && (
              <span>📍 {card.machineName ?? card.area}</span>
            )}
            <span>👤 {card.raisedByName}</span>
            <span>
              <Clock size={11} className="inline" />{' '}
              {card.raisedAt ? formatDistanceToNow(card.raisedAt.toDate(), { addSuffix: true }) : ''}
            </span>
          </div>

          {/* Vote */}
          <button
            onClick={handleVote}
            className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              hasVoted
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <ThumbsUp size={14} className={hasVoted ? 'fill-current' : ''} />
            {card.voteCount} {card.voteCount === 1 ? 'vote' : 'votes'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['details', 'timeline', ...(isProPlan ? ['roi'] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'roi' ? 'ROI' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'timeline' && card.comments.length > 0 && (
                <span className="ml-1 text-xs bg-gray-100 rounded-full px-1.5">
                  {card.comments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── Details ── */}
          {activeTab === 'details' && (
            <>
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Problem</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{card.problemStatement}</p>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Suggested Solution</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{card.suggestedSolution}</p>
              </section>

              {card.beforePhotos.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Before Photos</h3>
                  <div className="flex gap-2 flex-wrap">
                    {card.beforePhotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {card.afterPhotos.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">After Photos</h3>
                  <div className="flex gap-2 flex-wrap">
                    {card.afterPhotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {card.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {card.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {card.rejectionReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                  <p className="text-sm text-red-600">{card.rejectionReason}</p>
                </div>
              )}

              {card.onHoldReason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">On Hold</p>
                  <p className="text-sm text-amber-700">{card.onHoldReason}</p>
                  {card.onHoldUntil && (
                    <p className="text-xs text-amber-600 mt-0.5">Resume: {card.onHoldUntil}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Timeline ── */}
          {activeTab === 'timeline' && (
            <>
              {/* State changes */}
              {card.stateHistory.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">State History</h3>
                  <div className="space-y-3">
                    {[...card.stateHistory].reverse().map((change, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                          {i < card.stateHistory.length - 1 && (
                            <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="pb-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-0.5">
                            <span
                              className="font-semibold px-1.5 py-0.5 rounded text-xs"
                              style={{
                                color: KAIZEN_STATUS_META[change.fromStatus].color,
                                backgroundColor: KAIZEN_STATUS_META[change.fromStatus].bgColor,
                              }}
                            >
                              {KAIZEN_STATUS_META[change.fromStatus].label}
                            </span>
                            <ArrowRight size={12} />
                            <span
                              className="font-semibold px-1.5 py-0.5 rounded text-xs"
                              style={{
                                color: KAIZEN_STATUS_META[change.toStatus].color,
                                backgroundColor: KAIZEN_STATUS_META[change.toStatus].bgColor,
                              }}
                            >
                              {KAIZEN_STATUS_META[change.toStatus].label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {change.changedByName} ·{' '}
                            {change.changedAt
                              ? format(change.changedAt.toDate(), 'dd MMM yyyy HH:mm')
                              : ''}
                          </p>
                          {change.notes && (
                            <p className="text-xs text-gray-700 mt-0.5 italic">"{change.notes}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Comments */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
                  <MessageSquare size={12} /> Comments
                </h3>
                <div className="space-y-3">
                  {visibleComments.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No comments yet.</p>
                  )}
                  {visibleComments.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg text-sm ${
                        c.isInternal
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-gray-700">{c.userName}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          {c.isInternal && (
                            <span className="flex items-center gap-0.5 text-amber-600">
                              <Lock size={10} /> Internal
                            </span>
                          )}
                          <span>
                            {c.createdAt
                              ? formatDistanceToNow(c.createdAt.toDate(), { addSuffix: true })
                              : ''}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-800">{c.text}</p>
                    </div>
                  ))}
                </div>

                {/* Add comment */}
                <div className="mt-3 space-y-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between">
                    {canSeeInternal && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                        />
                        <Lock size={11} /> Internal (supervisors only)
                      </label>
                    )}
                    <button
                      onClick={handleAddComment}
                      disabled={submittingComment || !commentText.trim()}
                      className="ml-auto bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-60"
                    >
                      {submittingComment ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ── ROI (Factory Pro) ── */}
          {activeTab === 'roi' && roi && (
            <section className="space-y-4">
              {daysSinceVerified !== null && daysSinceVerified < 30 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <Clock className="mx-auto mb-2 text-amber-500" size={24} />
                  <p className="text-sm font-semibold text-amber-800">Benefit data not yet available</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Actual benefit data will be available 30 days after verification.
                    ({30 - daysSinceVerified} days remaining)
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Estimated Cost</p>
                      <p className="text-lg font-bold text-gray-900">
                        {card.estimatedCost != null
                          ? `LKR ${card.estimatedCost.toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Actual Cost</p>
                      <p className="text-lg font-bold text-gray-900">
                        {card.actualCost != null
                          ? `LKR ${card.actualCost.toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Est. Monthly Benefit</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {card.estimatedBenefit != null
                          ? `LKR ${card.estimatedBenefit.toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-0.5">Actual Monthly Benefit</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {card.actualBenefit != null
                          ? `LKR ${card.actualBenefit.toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {roi.roiMonths != null && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Payback Period</p>
                      <p className="text-3xl font-bold text-blue-800">{roi.roiMonths} months</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Annual benefit: LKR {roi.totalAnnualBenefit.toLocaleString()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {/* Action panel */}
        <div className="px-5 py-3 border-t border-gray-200 flex-shrink-0 space-y-2">
          {/* Main transitions */}
          {mainTransitions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {mainTransitions.map((to) => {
                const meta = KAIZEN_STATUS_META[to];
                return (
                  <button
                    key={to}
                    onClick={() => handleTransition(to)}
                    disabled={transitioning !== null}
                    className="flex-1 min-w-0 py-2 px-3 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: meta.color }}
                  >
                    {transitioning === to ? '...' : `→ ${meta.label}`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Notes for transition */}
          {mainTransitions.length > 0 && (
            <input
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              placeholder="Notes for this transition (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* After photo upload */}
          {(card.status === 'IN_PROGRESS' || card.status === 'IMPLEMENTED') && (
            <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 transition-colors w-fit text-xs text-gray-600">
              <Camera size={13} />
              {uploadingPhoto ? 'Uploading...' : 'Upload After Photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
            </label>
          )}

          {/* Secondary actions row */}
          {(availableTransitions.includes('REJECTED') || availableTransitions.includes('ON_HOLD')) && (
            <div className="flex gap-2">
              {availableTransitions.includes('ON_HOLD') && !showHoldForm && (
                <button
                  onClick={() => { setShowHoldForm(true); setShowRejectForm(false); }}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-200 rounded-lg px-2 py-1.5"
                >
                  <PauseCircle size={12} /> Put On Hold
                </button>
              )}
              {availableTransitions.includes('REJECTED') && !showRejectForm && (
                <button
                  onClick={() => { setShowRejectForm(true); setShowHoldForm(false); }}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded-lg px-2 py-1.5"
                >
                  <AlertTriangle size={12} /> Reject
                </button>
              )}
            </div>
          )}

          {/* Reject form */}
          {showRejectForm && (
            <div className="border border-red-200 rounded-lg p-3 space-y-2 bg-red-50">
              <p className="text-xs font-semibold text-red-700">Rejection Reason (required)</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Why is this being rejected?"
                className="w-full border border-red-300 rounded px-2 py-1.5 text-xs focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={transitioning !== null}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {transitioning === 'REJECTED' ? '...' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Hold form */}
          {showHoldForm && (
            <div className="border border-amber-200 rounded-lg p-3 space-y-2 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700">Put On Hold</p>
              <input
                value={onHoldReason}
                onChange={(e) => setOnHoldReason(e.target.value)}
                placeholder="Reason for hold"
                className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs focus:outline-none"
              />
              <input
                type="date"
                value={onHoldUntil}
                onChange={(e) => setOnHoldUntil(e.target.value)}
                className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHold}
                  disabled={transitioning !== null}
                  className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-60"
                >
                  {transitioning === 'ON_HOLD' ? '...' : 'Confirm Hold'}
                </button>
                <button
                  onClick={() => setShowHoldForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
