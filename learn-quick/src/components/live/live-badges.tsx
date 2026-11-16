"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type LiveEvent = { type: "notification" | "message"; payload?: { ref?: string } };
export const LIVE_EVENT = "lq:live";

/**
 * Header badges for unread notifications and messages. Opens the one live connection
 * of the page and re-broadcasts its events as a window event for other components.
 */
export function LiveBadges({ initial, messagesHref }: { initial: { notifications: number; messages: number }; messagesHref: string | null }) {
  const t = useTranslations("notifications");
  const [counts, setCounts] = useState(initial);
  useEffect(() => {
    setCounts(initial);
  }, [initial]);

  useEffect(() => {
    const es = new EventSource("/api/me/events");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const r = await fetch("/api/me/counts", { cache: "no-store" }).catch(() => null);
        if (r?.ok) setCounts(await r.json());
      }, 250);
    };
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as LiveEvent;
        window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: e }));
        refresh();
      } catch {}
    };
    // Counts also change when this person reads things on another page
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("lq:read", onFocus);
    return () => {
      es.close();
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("lq:read", onFocus);
    };
  }, []);

  const badge = (n: number) =>
    n > 0 && (
      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white" aria-hidden>
        {n > 99 ? "99+" : n}
      </span>
    );
  const cls = "relative grid size-9 place-items-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg";
  return (
    <>
      {messagesHref && (
        <Link href={messagesHref} className={cls} aria-label={t("messagesLabel", { count: counts.messages })} data-testid="messages-badge" data-count={counts.messages}>
          <MessageSquare className="size-5" aria-hidden />
          {badge(counts.messages)}
        </Link>
      )}
      <Link href="/notifications" className={cls} aria-label={t("bellLabel", { count: counts.notifications })} data-testid="bell" data-count={counts.notifications}>
        <Bell className="size-5" aria-hidden />
        {badge(counts.notifications)}
      </Link>
    </>
  );
}

/** Calls `onEvent` for live events of the page (e.g. to refresh a conversation). */
export function useLiveEvents(onEvent: (e: LiveEvent) => void) {
  useEffect(() => {
    const h = (ev: Event) => onEvent((ev as CustomEvent<LiveEvent>).detail);
    window.addEventListener(LIVE_EVENT, h);
    return () => window.removeEventListener(LIVE_EVENT, h);
  }, [onEvent]);
}
