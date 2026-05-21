interface QuizScoreBadgeProps {
  score: number;
  passingScore: number;
  className?: string;
}

export default function QuizScoreBadge({
  score,
  passingScore,
  className = '',
}: QuizScoreBadgeProps) {
  const passed = score >= passingScore;

  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
        passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Quiz score: ${score}% — ${passed ? 'Passed' : 'Failed'}`}
    >
      {score}%
    </span>
  );
}
