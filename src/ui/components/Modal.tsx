import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "lg",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === "sm"
      ? "w-[min(480px,calc(100%-2rem))]"
      : size === "md"
        ? "w-[min(640px,calc(100%-2rem))]"
        : "w-[min(720px,calc(100%-2rem))]";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        className={[
          "relative mx-auto mt-12 rounded-lg border border-border bg-surface shadow-xl",
          widthClass,
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-fg">{title}</div>
          <button
            type="button"
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-muted hover:bg-surface-hover"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
