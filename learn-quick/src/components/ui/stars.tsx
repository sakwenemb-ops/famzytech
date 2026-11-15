import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-4", i <= Math.round(value) ? "fill-accent text-accent" : "text-border")} />
      ))}
    </span>
  );
}
