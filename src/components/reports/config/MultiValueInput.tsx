export default function MultiValueInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-[#8BA3BF]">
      {label}
      <input
        value={values.join(', ')}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          )
        }
        placeholder={placeholder}
        className="min-h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
      />
    </label>
  );
}
