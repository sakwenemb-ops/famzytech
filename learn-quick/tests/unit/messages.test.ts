import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const keys = (o: object, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe("translations", () => {
  it("English and French have exactly the same keys", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
});
