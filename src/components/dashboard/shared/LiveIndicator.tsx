export default function LiveIndicator() {
  return (
    <span className="absolute top-3 right-3 flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
    </span>
  );
}
