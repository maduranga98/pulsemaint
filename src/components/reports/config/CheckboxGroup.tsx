export default function CheckboxGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#8BA3BF]">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label key={option} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? values.filter((value) => value !== option) : [...values, option])}
                className="h-4 w-4 accent-[#1A56DB]"
              />
              {option}
            </label>
          );
        })}
      </div>
    </div>
  );
}
