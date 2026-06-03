import { ThumbsUp, MessageSquare, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { KaizenCard as KaizenCardType } from '../types/kaizen.types';
import {
  KAIZEN_STATUS_META,
  KAIZEN_CATEGORY_META,
  KAIZEN_PRIORITY_META,
} from '../types/kaizen.types';
import { useAuthStore } from '../../../store/authStore';
import { voteOnKaizen } from '../services/kaizen.service';
import { toast } from 'sonner';

interface Props {
  card: KaizenCardType;
  onClick: (card: KaizenCardType) => void;
  isProPlan?: boolean;
}

export function KaizenCard({ card, onClick, isProPlan = false }: Props) {
  const plantId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const userId = useAuthStore((s) => s.userProfile?.id ?? '');

  const statusMeta = KAIZEN_STATUS_META[card.status];
  const categoryMeta = KAIZEN_CATEGORY_META[card.category];
  const priorityMeta = KAIZEN_PRIORITY_META[card.priority];
  const hasVoted = card.votes.includes(userId);
  const isHighPriority = card.priority === 'critical' || card.priority === 'high';

  const borderColor =
    card.priority === 'critical'
      ? '#EF4444'
      : card.priority === 'high'
        ? '#F59E0B'
        : statusMeta.borderColor;

  const timeAgo = card.raisedAt
    ? formatDistanceToNow(card.raisedAt.toDate(), { addSuffix: true })
    : '';

  async function handleVote(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await voteOnKaizen(plantId, card.id, userId);
    } catch {
      toast.error('Failed to vote');
    }
  }

  const benefitLKR = card.estimatedBenefit;
  const benefitLabel =
    benefitLKR != null
      ? benefitLKR >= 1000
        ? `LKR ${Math.round(benefitLKR / 1000)}K/mo`
        : `LKR ${benefitLKR}/mo`
      : null;

  return (
    <div
      onClick={() => onClick(card)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow select-none"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded"
          style={{ color: categoryMeta.color, backgroundColor: `${categoryMeta.color}15` }}
        >
          {categoryMeta.icon} {categoryMeta.label}
        </span>
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ color: priorityMeta.color, backgroundColor: priorityMeta.bgColor }}
        >
          {priorityMeta.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1.5 leading-snug">
        {card.title}
      </p>

      {/* Machine / area tag */}
      {(card.machineName || card.area) && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <MapPin size={11} />
          <span className="truncate">{card.machineName ?? card.area}</span>
        </div>
      )}

      {/* Factory Pro: benefit chip */}
      {isProPlan && benefitLabel && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            📈 {benefitLabel} benefit
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={11} />
          <span>{timeAgo}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 text-xs text-gray-400">
            <MessageSquare size={12} />
            <span>{card.comments.length}</span>
          </div>
          <button
            onClick={handleVote}
            className={`flex items-center gap-0.5 text-xs rounded px-1.5 py-0.5 transition-all ${
              hasVoted
                ? 'bg-blue-100 text-blue-700 font-semibold scale-105'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <ThumbsUp size={12} className={hasVoted ? 'fill-current' : ''} />
            <span>{card.voteCount}</span>
          </button>
        </div>
      </div>

      {/* Raiser */}
      <div className="mt-1.5 text-xs text-gray-400 truncate">
        {card.raisedByName}
      </div>
    </div>
  );
}
