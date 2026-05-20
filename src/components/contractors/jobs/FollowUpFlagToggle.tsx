interface FollowUpFlagToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function FollowUpFlagToggle({ enabled, onChange }: FollowUpFlagToggleProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
        The same issue returned within 30 days
      </label>
      {enabled && <textarea placeholder="Describe the follow-up issue" className="mt-3 min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />}
    </div>
  );
}

export default FollowUpFlagToggle;
