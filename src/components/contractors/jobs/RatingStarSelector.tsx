import { Star } from 'lucide-react';

interface RatingStarSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export function RatingStarSelector({ value, onChange }: RatingStarSelectorProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button key={score} type="button" onClick={() => onChange(score)} className="rounded-md p-1">
          <Star className={`h-7 w-7 ${score <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

export default RatingStarSelector;
