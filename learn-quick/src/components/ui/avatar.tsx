import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, src, size = 48, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote storage URLs; sized and lazy-loaded here
    return <img src={src} alt="" width={size} height={size} loading="lazy" className={cn("shrink-0 rounded-full object-cover", className)} style={style} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary", className)} style={style}>
      {initials(name)}
    </span>
  );
}
