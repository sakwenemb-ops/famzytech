export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
