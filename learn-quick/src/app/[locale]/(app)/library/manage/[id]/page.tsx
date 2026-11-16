import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { canManage } from "@/server/library/manage";
import { blankExercise, toForm } from "@/server/library/manage-view";
import { Badge } from "@/components/ui/badge";
import { ExerciseForm, StatusButtons } from "@/components/library/exercise-form";

export default async function EditExercisePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const role = await canManage(user);
  if (!role) notFound();
  const t = await getTranslations("manage");
  const exercise = id === "new" ? null : await db.exercise.findUnique({ where: { id } });
  if (id !== "new" && (!exercise || (role === "teacher" && exercise.authorId !== user.id))) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-10">
      <Link href="/library/manage" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden />{t("title")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{exercise ? t("edit") : t("new")}</h1>
        {exercise && <Badge tone={exercise.status === "PUBLISHED" ? "success" : "warning"}>{t(`status.${exercise.status}`)}</Badge>}
      </div>
      {exercise && role === "admin" && <StatusButtons id={exercise.id} status={exercise.status} />}
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
        <ExerciseForm key={exercise?.updatedAt.toISOString() ?? "new"} defaults={exercise ? toForm(exercise) : blankExercise} isAdmin={role === "admin"} />
      </div>
    </div>
  );
}
