interface Section7GeneralNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function Section7GeneralNotes({ value, onChange }: Section7GeneralNotesProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className="font-[Sora] font-bold">General Notes</h2>
        <p className="text-sm text-slate-300">Plain text notes for the incoming supervisor.</p>
      </div>
      <textarea
        value={value}
        maxLength={2000}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Anything not covered above"
        className="min-h-56 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      <p className="text-right text-xs text-slate-500">{value.length}/2000</p>
    </section>
  );
}

export default Section7GeneralNotes;
