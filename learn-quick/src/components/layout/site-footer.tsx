import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs space-y-2">
          <Logo />
          <p className="text-sm text-muted">{t("tagline")}</p>
        </div>
        <nav className="flex gap-5 text-sm text-muted" aria-label="Footer">
          <Link href="/terms" className="hover:text-fg">{t("terms")}</Link>
          <Link href="/privacy" className="hover:text-fg">{t("privacy")}</Link>
          <Link href="/contact" className="hover:text-fg">{t("contact")}</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        © {new Date().getFullYear()} Learn Quick. {t("rights")}
      </p>
    </footer>
  );
}
