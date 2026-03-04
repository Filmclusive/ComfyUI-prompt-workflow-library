export function Textarea({
  value,
  onChange,
  rows = 10,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-accent-ring"
    />
  );
}
