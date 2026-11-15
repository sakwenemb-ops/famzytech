"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/server/profile-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({ teacherId, initialSaved }: { teacherId: string; initialSaved: boolean }) {
  const t = useTranslations("teacherProfile");
  const [saved, setSaved] = useOptimistic(initialSaved);
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      block
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setSaved(!saved);
          await toggleFavoriteAction(teacherId);
        })
      }
    >
      <Heart aria-hidden className={cn("size-4", saved && "fill-danger text-danger")} />
      {saved ? t("saved") : t("save")}
    </Button>
  );
}
