import { describe, expect, it } from "vitest";
import { LIBRARY } from "../../prisma/library-content";

describe("starter library", () => {
  it("has 60 exercises: 5 per level in each direction, unique codes", () => {
    expect(LIBRARY).toHaveLength(60);
    expect(new Set(LIBRARY.map((e) => e.code)).size).toBe(60);
    for (const direction of ["EN_FR", "FR_EN"]) {
      for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
        expect(LIBRARY.filter((e) => e.direction === direction && e.level === level), `${direction} ${level}`).toHaveLength(5);
      }
    }
  });

  it("every exercise is complete for its type", () => {
    for (const e of LIBRARY) {
      expect(e.references.length, e.code).toBeGreaterThan(0);
      if (e.type === "FILL_GAP") expect(e.gapTemplate, e.code).toMatch(/___/);
      if (e.type === "MULTIPLE_CHOICE") {
        expect(e.options?.length, e.code).toBe(3);
        expect(e.options?.filter((o) => o.correct).map((o) => o.text), e.code).toEqual([e.references[0]]);
      }
    }
  });

  it("the correct answer is not always in the same place", () => {
    const positions = new Set(LIBRARY.filter((e) => e.options).map((e) => e.options!.findIndex((o) => o.correct)));
    expect(positions.size).toBe(3);
  });
});
