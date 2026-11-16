"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { markReadAction, sendMessageAction, type MessageState } from "@/server/message-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LiveRefresh } from "./live-refresh";

type Msg = { id: string; mine: boolean; body: string; at: string; read: boolean; redacted: boolean };
const MAX = 2000;

export function Thread({ conversationId, messages, canSend, timeZone }: { conversationId: string; me: string; messages: Msg[]; canSend: boolean; timeZone: string }) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const end = useRef<HTMLLIElement>(null);

  // Server-rendered list replaces the optimistic copies once it includes them
  const shown = [...messages, ...optimistic.filter((o) => !messages.some((m) => m.id === o.id))];
  useEffect(() => {
    // (scrollIntoView returns a Promise in new browsers: it must not be returned from the effect)
    end.current?.scrollIntoView({ block: "end" });
  }, [shown.length]);
  useEffect(() => {
    window.dispatchEvent(new Event("lq:read"));
  }, [messages.length]);

  const onIncoming = useCallback(() => {
    void markReadAction(conversationId).then(() => window.dispatchEvent(new Event("lq:read")));
  }, [conversationId]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const fd = new FormData();
    fd.set("body", body);
    const r: MessageState = await sendMessageAction(conversationId, undefined, fd).catch(() => ({ error: "failed" }));
    setSending(false);
    if (r?.error || !r?.id) return setError(r?.error ?? "failed");
    setOptimistic((o) => [...o, { id: r.id!, mine: true, body: r.body!, at: r.at!, read: false, redacted: Boolean(r.redacted) }]);
    setNotice(Boolean(r.redacted));
    setText("");
    router.refresh();
  }

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone });
  const lastMine = [...shown].reverse().find((m) => m.mine);

  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface">
      <LiveRefresh conversationId={conversationId} onMessage={onIncoming} />
      <ol className="flex max-h-[60vh] min-h-64 flex-col gap-2 overflow-y-auto p-4" aria-label={t("conversation")} aria-live="polite">
        {shown.length === 0 && <li className="m-auto text-sm text-muted">{t("startHint")}</li>}
        {shown.map((m) => (
          <li key={m.id} className={cn("flex max-w-[85%] flex-col", m.mine ? "items-end self-end" : "items-start self-start")} data-message={m.mine ? "mine" : "theirs"}>
            <p className={cn("whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px]", m.mine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-surface-2")}>{m.body}</p>
            <span className="mt-0.5 text-[11px] text-muted">
              {fmt.format(new Date(m.at))}
              {m.redacted && ` · ${t("redactedShort")}`}
              {m === lastMine && m.read && ` · ${t("seen")}`}
            </span>
          </li>
        ))}
        <li ref={end} aria-hidden className="h-0" />
      </ol>
      {canSend && (
        <form
          className="space-y-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {notice && <Alert tone="warning">{t("redactedNotice")}</Alert>}
          {error && <Alert tone="danger">{t(`errors.${["not_allowed", "too_many", "empty", "too_long", "not_found"].includes(error) ? error : "failed"}`)}</Alert>}
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("write")}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={MAX}
                rows={2}
                placeholder={t("write")}
                className="block w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface p-2.5 text-[16px] focus:border-primary focus:outline-none"
              />
            </label>
            <Button type="submit" disabled={sending || !text.trim()} aria-label={t("send")}>
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              <span className="hidden sm:inline">{t("send")}</span>
            </Button>
          </div>
          {text.length > MAX - 200 && <p className="text-right text-xs text-muted">{text.length} / {MAX}</p>}
        </form>
      )}
    </div>
  );
}
