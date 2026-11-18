import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { legalInfo } from "@/lib/legal";
import { getCurrentUser } from "@/server/session";
import { Card, CardBody } from "@/components/ui/card";
import { ContactForm } from "@/components/contact/contact-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title") };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const l = legalInfo();
  const user = await getCurrentUser();
  const wa = l.whatsapp.replace(/[^\d]/g, "");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardBody>
            <ContactForm defaults={{ name: user?.name ?? "", email: user?.email ?? "" }} />
          </CardBody>
        </Card>
        <aside className="space-y-4 text-sm">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-medium"><Mail className="size-4 text-primary" aria-hidden />{t("support")}</p>
            <a href={`mailto:${l.support}`} className="mt-1 block break-all text-primary hover:underline">{l.support}</a>
          </div>
          {wa && (
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
              <p className="flex items-center gap-2 font-medium"><MessageCircle className="size-4 text-primary" aria-hidden />WhatsApp</p>
              <a href={`https://wa.me/${wa}`} className="mt-1 block text-primary hover:underline">+{wa}</a>
            </div>
          )}
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" aria-hidden />{t("privacy")}</p>
            <a href={`mailto:${l.email}`} className="mt-1 block break-all text-primary hover:underline">{l.email}</a>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-medium"><Clock className="size-4 text-primary" aria-hidden />{t("hoursTitle")}</p>
            <p className="mt-1 text-muted">{t("hours")}</p>
          </div>
          <p className="px-1 text-muted">{l.company}<br />{l.address}</p>
        </aside>
      </div>
    </div>
  );
}
