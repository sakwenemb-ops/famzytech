/**
 * Time zones and bookable slots. Pure functions (no database), so they are easy to test.
 *
 * Teachers set weekly hours in THEIR time zone; students see slots in THEIR time zone;
 * everything is stored in UTC.
 */

export const LESSON_MIN = 50;
export const SLOT_STEP_MIN = 30; // lessons start on the hour or half hour

/** Wall-clock parts of a UTC instant in a time zone. */
export function zonedParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second, weekday };
}

/** Offset of the time zone from UTC at this instant, in minutes (e.g. +60 for Africa/Douala). */
export function tzOffsetMin(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** The UTC instant for a wall-clock time in a time zone (handles daylight-saving changes). */
export function zonedTimeToUtc(y: number, m: number, d: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  // Two passes settle the offset even around daylight-saving switches
  let t = guess - tzOffsetMin(new Date(guess), timeZone) * 60_000;
  t = guess - tzOffsetMin(new Date(t), timeZone) * 60_000;
  return new Date(t);
}

/** "YYYY-MM-DD" of an instant in a time zone. */
export function dayKey(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export type Rule = { weekday: number; startMin: number; endMin: number };
export type Busy = { startsAt: Date; endsAt: Date };
export type Exception = { startsAt: Date; endsAt: Date; available: boolean };

/**
 * Bookable lesson start times between `from` and `to`.
 * A slot is free when it lies inside the teacher's weekly hours, outside their time off,
 * does not overlap a booking, and starts at least `minNoticeMin` from now.
 */
export function freeSlots(opts: {
  rules: Rule[];
  teacherTimeZone: string;
  busy: Busy[];
  exceptions?: Exception[];
  from: Date;
  to: Date;
  now?: Date;
  minNoticeMin?: number;
  lessonMin?: number;
}): Date[] {
  const { rules, teacherTimeZone: tz, busy, exceptions = [], from, to } = opts;
  const lesson = (opts.lessonMin ?? LESSON_MIN) * 60_000;
  const earliest = (opts.now ?? new Date()).getTime() + (opts.minNoticeMin ?? 0) * 60_000;
  const off = exceptions.filter((e) => !e.available);
  const out: Date[] = [];

  // Walk each calendar day (in the teacher's zone) that touches the range
  const first = zonedParts(new Date(from.getTime() - 86_400_000), tz);
  for (let i = 0; ; i++) {
    const noonUtc = Date.UTC(first.year, first.month - 1, first.day + i, 12);
    const d = new Date(noonUtc);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate(), weekday = d.getUTCDay();
    if (zonedTimeToUtc(y, m, day, 0, tz) > to) break;

    for (const r of rules.filter((r) => r.weekday === weekday)) {
      for (let start = r.startMin; start + LESSON_MIN <= r.endMin; start += SLOT_STEP_MIN) {
        const s = zonedTimeToUtc(y, m, day, start, tz);
        const st = s.getTime(), en = st + lesson;
        if (st < from.getTime() || st >= to.getTime() || st < earliest) continue;
        const clash = (b: { startsAt: Date; endsAt: Date }) => st < b.endsAt.getTime() && en > b.startsAt.getTime();
        if (busy.some(clash) || off.some(clash)) continue;
        out.push(s);
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime()).filter((d, i, arr) => i === 0 || d.getTime() !== arr[i - 1].getTime());
}

/** Is this exact start time one of the free slots? Used to check a booking request on the server. */
export function isFreeSlot(start: Date, opts: Omit<Parameters<typeof freeSlots>[0], "from" | "to">) {
  const slots = freeSlots({ ...opts, from: start, to: new Date(start.getTime() + 60_000) });
  return slots.some((s) => s.getTime() === start.getTime());
}

/** Morning / afternoon / evening / night buckets, for the catalogue filter (in the student's zone). */
export const TIME_BUCKETS = { morning: [360, 720], afternoon: [720, 1080], evening: [1080, 1440], night: [0, 360] } as const;
export type TimeBucket = keyof typeof TIME_BUCKETS;

/**
 * Does the teacher teach on these days / at these times of day, as seen in the student's zone?
 * Uses next week's weekly hours (no bookings), which is a good proxy for "usually available".
 */
export function matchesAvailability(
  rules: Rule[],
  teacherTimeZone: string,
  studentTimeZone: string,
  want: { days: number[]; buckets: TimeBucket[] },
  now = new Date(),
) {
  if (!want.days.length && !want.buckets.length) return true;
  const slots = freeSlots({ rules, teacherTimeZone, busy: [], from: now, to: new Date(now.getTime() + 7 * 86_400_000), now });
  return slots.some((s) => {
    const p = zonedParts(s, studentTimeZone);
    const minute = p.hour * 60 + p.minute;
    const dayOk = !want.days.length || want.days.includes(p.weekday);
    const timeOk = !want.buckets.length || want.buckets.some((b) => minute >= TIME_BUCKETS[b][0] && minute < TIME_BUCKETS[b][1]);
    return dayOk && timeOk;
  });
}
