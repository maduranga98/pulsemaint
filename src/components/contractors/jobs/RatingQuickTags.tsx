interface RatingQuickTagsProps {
  onSelect?: (tag: string) => void;
}

const TAGS = ['Arrived on time', 'Neat workmanship', 'Explained the issue well', 'Left site clean', 'Required no callbacks', 'Professional team'];

export function RatingQuickTags({ onSelect }: RatingQuickTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => (
        <button key={tag} type="button" onClick={() => onSelect?.(tag)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
          {tag}
        </button>
      ))}
    </div>
  );
}

export default RatingQuickTags;
