import { describe, expect, it } from "vitest";
import { dayKey, freeSlots, isFreeSlot, matchesAvailability, tzOffsetMin, zonedParts, zonedTimeToUtc } from "@/lib/slots";

const iso = (d: Date) => d.toISOString().slice(0, 16);

describe("time zones", () => {
  it("knows Douala is UTC+1 all year, Paris switches for summer", () => {
    expect(tzOffsetMin(new Date("2026-01-15T12:00Z"), "Africa/Douala")).toBe(60);
    expect(tzOffsetMin(new Date("2026-07-15T12:00Z"), "Africa/Douala")).toBe(60);
    expect(tzOffsetMin(new Date("2026-01-15T12:00Z"), "Europe/Paris")).toBe(60);
    expect(tzOffsetMin(new Date("2026-07-15T12:00Z"), "Europe/Paris")).toBe(120);
    expect(tzOffsetMin(new Date("2026-07-15T12:00Z"), "America/Toronto")).toBe(-240);
  });

  it("converts local wall-clock times to UTC", () => {
    expect(iso(zonedTimeToUtc(2026, 11, 16, 18 * 60, "Africa/Douala"))).toBe("2026-11-16T17:00");
    expect(iso(zonedTimeToUtc(2026, 7, 1, 9 * 60, "Europe/Paris"))).toBe("2026-07-01T07:00");
    // Just after the spring-forward switch in Paris (29 March 2026, 02:00 → 03:00)
    expect(iso(zonedTimeToUtc(2026, 3, 29, 4 * 60, "Europe/Paris"))).toBe("2026-03-29T02:00");
  });

  it("gives the local day and weekday", () => {
    const late = new Date("2026-11-16T23:30Z"); // Monday 23:30 UTC
    expect(dayKey(late, "Africa/Douala")).toBe("2026-11-17"); // already Tuesday in Douala
    expect(zonedParts(late, "Africa/Douala").weekday).toBe(2);
  });
});

describe("free slots", () => {
  // Monday 16 Nov 2026; teacher in Douala teaches Monday 18:00–20:00 local
  const base = {
    rules: [{ weekday: 1, startMin: 18 * 60, endMin: 20 * 60 }],
    teacherTimeZone: "Africa/Douala",
    from: new Date("2026-11-16T00:00Z"),
    to: new Date("2026-11-17T00:00Z"),
    now: new Date("2026-11-15T00:00Z"),
  };

  it("offers 50-minute lessons on the hour and half hour inside the hours", () => {
    // 18:00, 18:30, 19:00 fit (19:00 + 50 min = 19:50); 19:30 would end at 20:20
    expect(freeSlots({ ...base, busy: [] }).map(iso)).toEqual(["2026-11-16T17:00", "2026-11-16T17:30", "2026-11-16T18:00"]);
  });

  it("removes slots that overlap a booking", () => {
    const busy = [{ startsAt: new Date("2026-11-16T17:30Z"), endsAt: new Date("2026-11-16T18:20Z") }];
    expect(freeSlots({ ...base, busy }).map(iso)).toEqual([]);
    const early = [{ startsAt: new Date("2026-11-16T17:00Z"), endsAt: new Date("2026-11-16T17:50Z") }];
    expect(freeSlots({ ...base, busy: early }).map(iso)).toEqual(["2026-11-16T18:00"]);
  });

  it("respects time off and minimum notice", () => {
    const exceptions = [{ startsAt: new Date("2026-11-16T00:00Z"), endsAt: new Date("2026-11-17T00:00Z"), available: false }];
    expect(freeSlots({ ...base, busy: [], exceptions })).toEqual([]);
    const now = new Date("2026-11-16T12:00Z");
    expect(freeSlots({ ...base, busy: [], now, minNoticeMin: 6 * 60 }).map(iso)).toEqual(["2026-11-16T18:00"]);
  });

  it("checks one requested start time", () => {
    expect(isFreeSlot(new Date("2026-11-16T17:30Z"), { ...base, busy: [] })).toBe(true);
    expect(isFreeSlot(new Date("2026-11-16T17:15Z"), { ...base, busy: [] })).toBe(false); // not on the grid
    expect(isFreeSlot(new Date("2026-11-16T19:00Z"), { ...base, busy: [] })).toBe(false); // outside the hours
  });

  it("a Monday-evening teacher in Douala is a Monday-afternoon teacher in Toronto", () => {
    const rules = base.rules;
    const now = new Date("2026-11-14T00:00Z");
    expect(matchesAvailability(rules, "Africa/Douala", "America/Toronto", { days: [1], buckets: ["afternoon"] }, now)).toBe(true);
    expect(matchesAvailability(rules, "Africa/Douala", "America/Toronto", { days: [1], buckets: ["evening"] }, now)).toBe(false);
    expect(matchesAvailability(rules, "Africa/Douala", "Africa/Douala", { days: [2], buckets: [] }, now)).toBe(false);
  });
});
