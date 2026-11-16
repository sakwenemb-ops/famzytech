/** Scoring rules that don't need AI. Pure functions, unit-tested. */

export const RUBRIC_WEIGHTS = { accuracy: 0.4, grammar: 0.25, vocabulary: 0.2, style: 0.15 } as const;
export type Rubric = { accuracy: number; grammar: number; vocabulary: number; style: number };

/** Using the vocabulary hint lowers the best possible score by 20%. */
export const HINT_FACTOR = 0.8;
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lower case, one space between words, curly quotes and apostrophes made plain, end punctuation ignored. */
export function normalize(s: string, opts: { keepAccents?: boolean } = {}) {
  let t = s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»"“”]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,;:!?.])\s*/g, "$1 ")
    .trim()
    .replace(/[.!?;:,\s]+$/g, "");
  if (!opts.keepAccents) t = stripAccents(t);
  return t;
}

/** Edit distance between two strings (characters). */
export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0–100: how close the answer is to the nearest reference translation. */
export function similarityScore(answer: string, references: string[]) {
  const a = normalize(answer, { keepAccents: true });
  if (!a) return 0;
  let best = 0;
  for (const ref of references) {
    const r = normalize(ref, { keepAccents: true });
    const len = Math.max(a.length, r.length);
    best = Math.max(best, len ? 1 - levenshtein(a, r) / len : 0);
  }
  return Math.round(best * 100);
}

export type GapResult = { score: number; accentOnly: boolean };

/** Fill-the-gap: exact (ignoring case and spacing) = 100; right word but an accent missing = 80. */
export function gradeGap(answer: string, accepted: string[]): GapResult {
  const withAccents = normalize(answer, { keepAccents: true });
  if (!withAccents) return { score: 0, accentOnly: false };
  if (accepted.some((x) => normalize(x, { keepAccents: true }) === withAccents)) return { score: 100, accentOnly: false };
  if (accepted.some((x) => normalize(x) === normalize(answer))) return { score: 80, accentOnly: true };
  return { score: 0, accentOnly: false };
}

/** Weighted rubric score, computed here rather than trusting the model's arithmetic. */
export function rubricScore(r: Rubric) {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return Math.round(
    clamp(r.accuracy) * RUBRIC_WEIGHTS.accuracy +
      clamp(r.grammar) * RUBRIC_WEIGHTS.grammar +
      clamp(r.vocabulary) * RUBRIC_WEIGHTS.vocabulary +
      clamp(r.style) * RUBRIC_WEIGHTS.style,
  );
}

export const withHint = (score: number, hintUsed: boolean) => (hintUsed ? Math.round(score * HINT_FACTOR) : score);

/** Overall percentage of an attempt from item scores and points. */
export function attemptPercent(items: { score: number; points: number }[]) {
  const total = items.reduce((s, i) => s + i.points, 0);
  return total ? Math.round(items.reduce((s, i) => s + (i.score * i.points) / 100, 0) / total * 100) : 0;
}

/** Level shown after a test: the test's level if passed well, lower if the score is weak. */
export function estimateLevel(testLevel: (typeof LEVELS)[number], percent: number) {
  const i = LEVELS.indexOf(testLevel);
  const drop = percent >= 70 ? 0 : percent >= 50 ? 1 : 2;
  return LEVELS[Math.max(0, i - drop)];
}

/** Find where a quoted mistake appears in the student's text (case-insensitive), for highlighting. */
export function locate(text: string, excerpt: string): [number, number] | null {
  if (!excerpt.trim()) return null;
  const i = text.toLowerCase().indexOf(excerpt.toLowerCase());
  return i < 0 ? null : [i, i + excerpt.length];
}
