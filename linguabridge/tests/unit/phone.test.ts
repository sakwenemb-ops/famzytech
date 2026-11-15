import { describe, expect, it } from "vitest";
import { cameroonOperator, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["670000000", "+237670000000"],
    ["6 70 00 00 00", "+237670000000"],
    ["+237 690-00-00-00", "+237690000000"],
    ["00237655000000", "+237655000000"],
    ["+33612345678", "+33612345678"],
  ])("%s -> %s", (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(["12345", "570000000", "+2375700000000", "+23767000000", "abc"])("rejects %s", (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );
});

describe("cameroonOperator", () => {
  it.each([
    ["+237670000000", "MTN"],
    ["+237652000000", "MTN"],
    ["+237681000000", "MTN"],
    ["+237690000000", "ORANGE"],
    ["+237656000000", "ORANGE"],
    ["+237660000000", "NEXTTEL"],
    ["+237222000000", "CAMTEL"],
    ["+33612345678", "UNKNOWN"],
  ])("%s is %s", (n, op) => expect(cameroonOperator(n)).toBe(op));
});
