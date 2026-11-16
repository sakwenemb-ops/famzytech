"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLiveEvents, type LiveEvent } from "@/components/live/live-badges";

/** Re-reads the page from the server when a new message arrives (optionally only for one conversation). */
export function LiveRefresh({ conversationId, onMessage }: { conversationId?: string; onMessage?: () => void }) {
  const router = useRouter();
  const handler = useCallback(
    (e: LiveEvent) => {
      if (e.type !== "message") return;
      if (conversationId && e.payload?.ref !== conversationId) return;
      onMessage?.();
      router.refresh();
    },
    [conversationId, onMessage, router],
  );
  useLiveEvents(handler);
  return null;
}
