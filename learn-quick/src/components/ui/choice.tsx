import { cn } from "@/lib/utils";

/** A checkbox or radio styled as a selectable card or chip. Works without JavaScript. */
export function Choice({
  type = "checkbox",
  variant = "card",
  className,
  children,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { variant?: "card" | "chip"; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "cursor-pointer border transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-surface-2 has-[:checked]:hover:bg-primary-soft",
        variant === "card" ? "flex items-start gap-3 rounded-[var(--radius-md)] border-border p-3" : "inline-flex items-center rounded-full border-border px-3.5 py-1.5 text-sm",
        className,
      )}
    >
      <input type={type} className={cn(variant === "card" ? "mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]" : "sr-only")} {...input} />
      {children}
    </label>
  );
}
