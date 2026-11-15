import { z } from "zod";

const slotSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) })
      .refine((s) => s.startMin % 30 === 0 && s.endMin % 30 === 0 && s.endMin - s.startMin >= 60, "slot_invalid"),
  )
  .min(1, "slot_required")
  .max(70);

export type WeeklySlot = { weekday: number; startMin: number; endMin: number };

/** Validate the weekly hours sent by the availability editor (a JSON string). */
export function parseWeeklySlots(json: string): { slots: WeeklySlot[] } | { error: string } {
  let raw: unknown = [];
  try {
    raw = JSON.parse(json || "[]");
  } catch {}
  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "slot_invalid" };
  const slots = [...parsed.data].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].weekday === slots[i - 1].weekday && slots[i].startMin < slots[i - 1].endMin) return { error: "slot_overlap" };
  }
  return { slots };
}
