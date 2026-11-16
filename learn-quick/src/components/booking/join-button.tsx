"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

/** Turns into a "Join" button when the classroom opens (10 minutes before), without reloading. */
export function JoinButton({ bookingId, opensAt, closesAt }: { bookingId: string; opensAt: string; closesAt: string }) {
  const t = useTranslations("lessons");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const open = now >= new Date(opensAt).getTime() && now <= new Date(closesAt).getTime();
  if (!open) return <span className="text-muted">{t("joinSoon")}</span>;
  return (
    <Link href={`/lesson/${bookingId}`} className={buttonVariants({ size: "sm" })}>
      <Video className="size-4" aria-hidden />
      {t("join")}
    </Link>
  );
}
