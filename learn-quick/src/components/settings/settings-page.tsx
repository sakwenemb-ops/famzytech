import { getTranslations } from "next-intl/server";
import type { User } from "@prisma/client";
import { timeZones } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/dashboard/shell";
import { AccountForm } from "./account-form";
import { PasswordForm } from "./password-form";

/** Shared settings content for every role. `extra` adds role-specific sections (e.g. learning preferences). */
export async function SettingsContent({ user, extra }: { user: User; extra?: React.ReactNode }) {
  const t = await getTranslations("settings");
  const ta = await getTranslations("auth");

  const contact = [
    { label: ta("phone"), value: user.phone, verified: Boolean(user.phoneVerified) },
    { label: ta("email"), value: user.email, verified: Boolean(user.emailVerified) },
  ];

  return (
    <>
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>{t("account")}</CardTitle></CardHeader>
          <CardBody>
            <AccountForm
              defaults={{ name: user.name, country: user.country, city: user.city, timeZone: user.timeZone, locale: user.locale }}
              timeZones={timeZones()}
            />
          </CardBody>
        </Card>

        {extra}

        <Card>
          <CardHeader><CardTitle>{t("contact")}</CardTitle></CardHeader>
          <CardBody>
            <dl className="divide-y divide-border text-sm">
              {contact.map((c) => (
                <div key={c.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                  <dt className="text-muted">{c.label}</dt>
                  <dd className="flex items-center gap-2">
                    <span>{c.value ?? t("none")}</span>
                    {c.value && (c.verified ? <Badge tone="success">{t("verified")}</Badge> : <Badge tone="warning">{t("notVerified")}</Badge>)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] text-muted">{t("contactHint")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("password")}</CardTitle></CardHeader>
          <CardBody>
            <PasswordForm hasPassword={Boolean(user.passwordHash)} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
