import "server-only";
import { z } from "zod";

/** Whiteboard strokes use coordinates from 0 to 1, so they look the same on any screen size. */
export const strokeSchema = z.object({
  id: z.string().max(40),
  tool: z.enum(["pen", "eraser"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().min(1).max(40),
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(600),
});
export type Stroke = z.infer<typeof strokeSchema>;

export const MAX_STROKES = 3000;

/** Everything a participant may send into the room. Anything else is refused. */
export const roomMessageSchema = z.discriminatedUnion("type", [
  // WebRTC signalling (offer / answer / ICE candidate), only to the other participant
  z.object({ type: z.literal("signal"), payload: z.object({ description: z.any().optional(), candidate: z.any().optional() }) }),
  z.object({ type: z.literal("chat"), payload: z.object({ text: z.string().trim().min(1).max(2000) }) }),
  z.object({ type: z.literal("file"), payload: z.object({ docId: z.string().max(40), name: z.string().max(200) }) }),
  // A stroke being drawn (shown live, not saved) and a finished stroke (saved)
  z.object({ type: z.literal("wb-live"), payload: strokeSchema }),
  z.object({ type: z.literal("wb"), payload: strokeSchema }),
  z.object({ type: z.literal("wb-clear"), payload: z.object({}).optional() }),
  z.object({ type: z.literal("notes"), payload: z.object({ text: z.string().max(20_000) }) }),
  // Camera/mic state and "please send me audio only" (data saving)
  z.object({ type: z.literal("media"), payload: z.object({ camera: z.boolean(), mic: z.boolean(), audioOnly: z.boolean(), sharing: z.boolean() }) }),
]);
export type RoomMessage = z.infer<typeof roomMessageSchema>;
