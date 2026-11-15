import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { LESSON_MINUTES } from "@/lib/constants";
import { requireRole } from "@/server/session";
import { amountDue } from "@/server/booking";
import { devPaymentsEnabled } from "@/server/booking-actions";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { CancelHoldButton, DevPayButton, HoldTimer } from "@/components/booking/checkout-actions";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const b = await db.booking.findUnique({
    where: { id },
    include: { student: true, teacher: { include: { user: { select: { name: true } } } } },
  });
  if (!b || b.student.userId !== user.id) notFound();

  const t = await getTranslations("checkout");
  const tl = await getTranslations("lessons");
  const loc = locale as "en" | "fr";
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: user.timeZone }).format(b.startsAt);
  const live = b.status === "HELD" && b.holdExpiresAt && b.holdExpiresAt > new Date();
  const teacherHref = `/teachers/${b.teacherId}`;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar name={b.teacher.user.name} src={b.teacher.photoUrl} size={48} />
          <p className="font-semibold">{t("lessonWith", { name: b.teacher.user.name })}</p>
        </div>
        <dl className="mt-4 divide-y divide-border text-sm">
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{t("when")}</dt><dd className="text-right">{when}</dd></div>
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{t("type")}</dt><dd>{tl(`types.${b.type}`)} · {t("duration", { minutes: LESSON_MINUTES })}</dd></div>
          {b.packageSize && <div className="py-2.5 text-muted">{t("pack", { size: b.packageSize, price: formatXaf(b.priceXaf, loc) })}</div>}
          <div className="flex justify-between gap-4 py-2.5 text-base font-semibold"><dt>{t("total")}</dt><dd className="tabular-nums">{formatXaf(amountDue(b), loc)}</dd></div>
        </dl>
      </div>

      <div className="mt-6 space-y-4">
        {b.status === "CONFIRMED" ? (
          <>
            <Alert tone="success">{t("confirmed")}</Alert>
            <Link href="/student/lessons" className={buttonVariants({ block: true })}>{tl("title")}</Link>
          </>
        ) : live ? (
          <>
            <HoldTimer expiresAt={b.holdExpiresAt!.toISOString()} />
            <section className="space-y-3">
              <h2 className="font-semibold">{t("payTitle")}</h2>
              <p className="text-sm text-muted">{t("paySoon")}</p>
              {(await devPaymentsEnabled()) && <DevPayButton bookingId={b.id} />}
            </section>
            <CancelHoldButton bookingId={b.id} teacherHref={teacherHref} />
          </>
        ) : (
          <>
            <Alert tone="warning">{t("expired")}</Alert>
            <Link href={teacherHref} className={buttonVariants({ block: true })}>{t("backToTeacher")}</Link>
          </>
        )}
      </div>
    </div>
  );
}
