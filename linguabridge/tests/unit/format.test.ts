import { describe, expect, it } from "vitest";
import { formatXaf } from "@/lib/utils";

describe("formatXaf", () => {
  it("groups thousands with spaces in both languages", () => {
    expect(formatXaf(5000, "fr")).toBe("5 000 FCFA");
    expect(formatXaf(1250000, "en")).toBe("1 250 000 FCFA");
    expect(formatXaf(0)).toBe("0 FCFA");
  });
});
