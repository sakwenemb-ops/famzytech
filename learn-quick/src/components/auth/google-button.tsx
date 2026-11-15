import { getTranslations } from "next-intl/server";
import { googleSignInAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

export async function GoogleButton() {
  const t = await getTranslations("auth");
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("orContinue")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <form action={googleSignInAction}>
        <Button variant="secondary" block>
          {t("google")}
        </Button>
      </form>
    </>
  );
}
