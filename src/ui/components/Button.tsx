import { clsx } from "clsx";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-ring";
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/70"
      : variant === "danger"
        ? "bg-danger text-white hover:bg-danger-hover disabled:bg-danger/70"
        : "border border-border bg-surface text-fg hover:bg-surface-hover disabled:bg-surface";

  return (
    <button
      type="button"
      className={clsx(base, styles, disabled && "opacity-60")}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
