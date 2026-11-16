import "server-only";
import type { Exercise } from "@prisma/client";
import type { ExerciseDefaults } from "@/components/library/exercise-form";

/** An exercise as the editor's text areas show it. */
export function toForm(e: Exercise): ExerciseDefaults {
  const options = (e.options ?? []) as { text: string; correct: boolean }[];
  const vocab = (e.keyVocabulary ?? []) as { source: string; target: string }[];
  return {
    id: e.id,
    code: e.code,
    type: e.type,
    direction: e.direction,
    level: e.level,
    topic: e.topic,
    sourceText: e.sourceText,
    references: e.references.join("\n"),
    gapTemplate: e.gapTemplate ?? "",
    options: options.map((o) => `${o.correct ? "*" : ""}${o.text}`).join("\n"),
    keyVocabulary: vocab.map((v) => `${v.source} = ${v.target}`).join("\n"),
    commonMistakes: e.commonMistakes ?? "",
  };
}

export const blankExercise: ExerciseDefaults = {
  type: "SENTENCE", direction: "EN_FR", level: "A2", topic: "DAILY_LIFE", sourceText: "", references: "", gapTemplate: "", options: "", keyVocabulary: "", commonMistakes: "",
};
