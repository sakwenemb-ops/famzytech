import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-muted">{t("notFoundBody")}</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>{t("backHome")}</Link>
    </div>
  );
}
