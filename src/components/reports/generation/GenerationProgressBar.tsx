export default function GenerationProgressBar({ progress }: { progress: number }) {
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-[#1E3A5F]">
        <div className="h-full rounded-full bg-[#1A56DB] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-right text-xs text-[#8BA3BF]">{progress}%</p>
    </div>
  );
}
