import { describe, expect, it } from "vitest";
import { attemptPercent, estimateLevel, gradeGap, levenshtein, locate, normalize, rubricScore, similarityScore, withHint } from "@/lib/grading";

describe("normalize", () => {
  it("ignores case, spacing, curly quotes and end punctuation", () => {
    expect(normalize("  J’ai  FAIM ! ")).toBe("j'ai faim");
    expect(normalize("« Bonjour »")).toBe("bonjour");
    expect(normalize("Où est-il ?", { keepAccents: true })).toBe("où est-il");
    expect(normalize("Où est-il ?")).toBe("ou est-il");
  });
});

describe("fill the gap", () => {
  it("accepts any listed answer, and gives 80 when only an accent is missing", () => {
    expect(gradeGap("suis allée", ["suis allé", "suis allée"])).toEqual({ score: 100, accentOnly: false });
    expect(gradeGap("Suis Allé.", ["suis allé"])).toEqual({ score: 100, accentOnly: false });
    expect(gradeGap("suis alle", ["suis allé"])).toEqual({ score: 80, accentOnly: true });
    expect(gradeGap("ai allé", ["suis allé"])).toEqual({ score: 0, accentOnly: false });
    expect(gradeGap("   ", ["suis allé"])).toEqual({ score: 0, accentOnly: false });
  });
});

describe("basic similarity score", () => {
  it("is 100 for a reference, high for a near miss, low for something else", () => {
    expect(levenshtein("chat", "chats")).toBe(1);
    expect(similarityScore("Je mange une pomme.", ["Je mange une pomme"])).toBe(100);
    expect(similarityScore("Je mange un pomme", ["Je mange une pomme"])).toBeGreaterThan(90);
    expect(similarityScore("Il fait beau aujourd'hui", ["Je mange une pomme"])).toBeLessThan(40);
    expect(similarityScore("", ["x"])).toBe(0);
    // The closest of several accepted translations counts
    expect(similarityScore("I have lived here for two years", ["I've been living here for two years", "I have lived here for two years"])).toBe(100);
  });
});

describe("rubric and attempt scores", () => {
  it("weights meaning 40, grammar 25, vocabulary 20, style 15", () => {
    expect(rubricScore({ accuracy: 100, grammar: 100, vocabulary: 100, style: 100 })).toBe(100);
    expect(rubricScore({ accuracy: 100, grammar: 0, vocabulary: 0, style: 0 })).toBe(40);
    expect(rubricScore({ accuracy: 80, grammar: 60, vocabulary: 90, style: 70 })).toBe(76); // 32 + 15 + 18 + 10.5 = 75.5
    expect(rubricScore({ accuracy: 150, grammar: -5, vocabulary: 100, style: 100 })).toBe(75); // out-of-range values are clamped
  });

  it("the hint lowers the maximum by 20%", () => {
    expect(withHint(100, true)).toBe(80);
    expect(withHint(90, false)).toBe(90);
  });

  it("combines items by their points, and estimates a level", () => {
    expect(attemptPercent([{ score: 100, points: 10 }, { score: 50, points: 10 }])).toBe(75);
    expect(attemptPercent([{ score: 100, points: 30 }, { score: 0, points: 10 }])).toBe(75);
    expect(attemptPercent([])).toBe(0);
    expect(estimateLevel("B2", 85)).toBe("B2");
    expect(estimateLevel("B2", 60)).toBe("B1");
    expect(estimateLevel("B2", 30)).toBe("A2");
    expect(estimateLevel("A1", 10)).toBe("A1");
  });

  it("finds a quoted mistake in the student's text", () => {
    expect(locate("Je suis allé au marché", "Suis allé")).toEqual([3, 12]);
    expect(locate("abc", "zzz")).toBeNull();
  });
});
