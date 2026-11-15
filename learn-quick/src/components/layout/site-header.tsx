import { getTranslations } from "next-intl/server";
import { Menu } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, dashboardPath } from "@/server/session";
import { logoutAction } from "@/server/auth-actions";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();
  const links = [
    { href: "/teachers", label: t("findTeacher") },
    { href: "/library", label: t("library") },
    { href: "/become-a-teacher", label: t("becomeTeacher") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleSwitcher />
          {user ? (
            <>
              <Link href={dashboardPath(user.role)} className={buttonVariants({ variant: "secondary", size: "sm", className: "hidden sm:inline-flex" })}>
                {t("dashboard")}
              </Link>
              <form action={logoutAction} className="hidden sm:block">
                <button className={buttonVariants({ variant: "ghost", size: "sm" })}>{t("logout")}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
                {t("login")}
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                {t("register")}
              </Link>
            </>
          )}
          {/* Mobile menu: plain <details>, works without JavaScript */}
          <details className="group relative md:hidden">
            <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-[var(--radius-md)] hover:bg-surface-2 [&::-webkit-details-marker]:hidden" aria-label={t("menu")}>
              <Menu className="size-5" aria-hidden />
            </summary>
            <div className="absolute right-0 top-11 w-60 rounded-[var(--radius-lg)] border border-border bg-surface p-2 shadow-lg">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="block rounded-[var(--radius-md)] px-3 py-2.5 text-sm hover:bg-surface-2">
                  {l.label}
                </Link>
              ))}
              <div className="my-1 border-t border-border" />
              {user ? (
                <>
                  <Link href={dashboardPath(user.role)} className="block rounded-[var(--radius-md)] px-3 py-2.5 text-sm hover:bg-surface-2">
                    {t("dashboard")}
                  </Link>
                  <form action={logoutAction}>
                    <button className="w-full rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm hover:bg-surface-2">{t("logout")}</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="block rounded-[var(--radius-md)] px-3 py-2.5 text-sm hover:bg-surface-2">
                  {t("login")}
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
