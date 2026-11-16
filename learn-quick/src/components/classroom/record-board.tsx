"use client";

import { Whiteboard, type Stroke } from "./whiteboard";

/** The lesson's final whiteboard, read only. */
export function RecordBoard({ strokes }: { strokes: Stroke[] }) {
  return <Whiteboard initial={strokes} send={() => undefined} readOnly />;
}
