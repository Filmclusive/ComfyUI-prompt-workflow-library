export function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-accent-ring"
    />
  );
}
