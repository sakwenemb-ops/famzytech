import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[15px] text-fg placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "appearance-auto", className)} {...props} />;
}

/** Label + control + hint + error, wired up with aria attributes. */
export function Field({
  id,
  label,
  hint,
  error,
  optionalLabel,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  children: (aria: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">({optionalLabel})</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
