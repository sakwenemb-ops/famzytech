"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RoomEvent = { type: string; from: string; to?: string; payload?: unknown; at: string };

/**
 * Live connection to a lesson room. EventSource reconnects by itself after a network drop
 * (common on mobile data); the server records each connection as attendance.
 */
export function useRoom(bookingId: string, onEvent: (e: RoomEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const es = new EventSource(`/api/lessons/${bookingId}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as RoomEvent;
        if (e.type === "hello") setMe((e.payload as { you: string }).you);
        handler.current(e);
      } catch {}
    };
    return () => es.close();
  }, [bookingId]);

  const send = useCallback(
    async (type: string, payload?: unknown) => {
      const res = await fetch(`/api/lessons/${bookingId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      return res.ok ? res.json() : null;
    },
    [bookingId],
  );

  return { connected, me, send };
}
