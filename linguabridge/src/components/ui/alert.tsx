import { cn } from "@/lib/utils";

const tones = {
  danger: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  info: "border-primary/20 bg-primary-soft text-primary",
  warning: "border-warning/30 bg-warning-soft text-warning",
};

export function Alert({ tone = "info", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  return <div role="status" className={cn("rounded-[var(--radius-md)] border px-4 py-3 text-sm", tones[tone], className)} {...props} />;
}
