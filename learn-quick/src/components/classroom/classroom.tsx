"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Send, Signal, Video, VideoOff, WifiLow } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FileUpload } from "@/components/application/file-upload";
import { PreJoin, VIDEO_CONSTRAINTS } from "./pre-join";
import { useRoom, type RoomEvent } from "./use-room";
import { useCall, type PeerMedia } from "./use-call";
import { Whiteboard, type Stroke, type WhiteboardHandle } from "./whiteboard";

export type ChatItem = { id: string; from: string; text: string; fileId?: string | null; at: string };

type Props = {
  bookingId: string;
  role: "student" | "teacher";
  me: { id: string; name: string };
  other: { id: string; name: string };
  iceServers: RTCIceServer[];
  initial: { chat: ChatItem[]; strokes: Stroke[]; notes: string };
  backHref: string;
};

export function Classroom(props: Props) {
  const [joined, setJoined] = useState<{ stream: MediaStream | null; audioOnly: boolean } | null>(null);
  if (!joined) {
    return (
      <div className="px-4 py-8">
        <PreJoin onJoin={(stream, audioOnly) => setJoined({ stream, audioOnly })} />
      </div>
    );
  }
  return <LiveRoom {...props} stream={joined.stream} startAudioOnly={joined.audioOnly} />;
}

function LiveRoom({ bookingId, role, me, other, iceServers, initial, backHref, stream, startAudioOnly }: Props & { stream: MediaStream | null; startAudioOnly: boolean }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const router = useRouter();
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const board = useRef<WhiteboardHandle>(null);
  const [otherHere, setOtherHere] = useState(false);
  const [peer, setPeer] = useState<PeerMedia>({ camera: true, mic: true, audioOnly: false, sharing: false });
  const [mic, setMic] = useState(Boolean(stream?.getAudioTracks().length));
  const [camera, setCamera] = useState(Boolean(stream?.getVideoTracks().length) && !startAudioOnly);
  const [audioOnly, setAudioOnly] = useState(startAudioOnly);
  const [sharing, setSharing] = useState<MediaStreamTrack | null>(null);
  const [tab, setTab] = useState<"chat" | "board" | "notes">("chat");
  const [chat, setChat] = useState<ChatItem[]>(initial.chat);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState(initial.notes);
  const [notesSaved, setNotesSaved] = useState(true);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const sendRef = useRef<(type: string, payload?: unknown) => Promise<unknown>>(async () => null);

  const call = useCall({
    polite: role === "student",
    iceServers,
    localStream: stream,
    sendSignal: (payload) => void sendRef.current("signal", payload),
  });

  const onEvent = useCallback(
    (e: RoomEvent) => {
      switch (e.type) {
        case "hello":
          if ((e.payload as { present: string[] }).present.includes(other.id)) {
            setOtherHere(true);
            call.start();
          }
          break;
        case "joined":
          if (e.from === other.id) {
            setOtherHere(true);
            call.start();
          }
          break;
        case "left":
          if (e.from === other.id) {
            setOtherHere(false);
            call.close();
          }
          break;
        case "signal":
          void call.onSignal(e.payload as never);
          break;
        case "chat": {
          const p = e.payload as { id: string; text: string; fileId?: string; at: string };
          setChat((c) => (c.some((x) => x.id === p.id) ? c : [...c, { id: p.id, from: e.from, text: p.text, fileId: p.fileId, at: p.at }]));
          setUnread((n) => n + 1);
          break;
        }
        case "wb-live":
          board.current?.remoteLive(e.payload as Stroke);
          break;
        case "wb":
          board.current?.remoteStroke(e.payload as Stroke);
          break;
        case "wb-clear":
          board.current?.remoteClear();
          break;
        case "notes":
          setNotes((e.payload as { text: string }).text);
          break;
        case "media":
          setPeer(e.payload as PeerMedia);
          break;
      }
    },
    // call's functions are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [other.id],
  );

  const room = useRoom(bookingId, onEvent);
  sendRef.current = room.send;

  // Show our own video, and the other person's
  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = sharing ? new MediaStream([sharing]) : stream;
  }, [stream, sharing, camera]);
  useEffect(() => {
    if (remoteVideo.current && call.remoteStream) remoteVideo.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  // Tell the other side what we're sending (whenever it changes, or they arrive)
  const { send } = room;
  useEffect(() => {
    void send("media", { camera, mic, audioOnly, sharing: Boolean(sharing) });
  }, [camera, mic, audioOnly, sharing, otherHere, send]);

  // If the other person chose audio only, stop sending them our video too
  useEffect(() => {
    if (peer.audioOnly && !sharing) void call.replaceVideo(null);
    else if (!peer.audioOnly && camera && !sharing) void call.replaceVideo(stream?.getVideoTracks()[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.audioOnly]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Stop the camera and microphone when leaving the page
  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream]);

  const toggleMic = () => {
    stream?.getAudioTracks().forEach((tr) => (tr.enabled = !mic));
    setMic(!mic);
  };

  const setVideo = async (on: boolean) => {
    let track = stream?.getVideoTracks()[0] ?? null;
    if (on && (!track || track.readyState === "ended")) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
        track = s.getVideoTracks()[0];
        stream?.getVideoTracks().forEach((old) => stream.removeTrack(old));
        stream?.addTrack(track);
      } catch {
        return;
      }
    }
    if (!on) track?.stop();
    if (!sharing) await call.replaceVideo(on && !peer.audioOnly ? track : null);
    setCamera(on);
  };

  const toggleAudioOnly = async () => {
    const next = !audioOnly;
    setAudioOnly(next);
    await setVideo(!next);
  };

  const toggleShare = async () => {
    if (sharing) {
      sharing.stop();
      setSharing(null);
      await call.replaceVideo(camera && !peer.audioOnly ? stream?.getVideoTracks()[0] ?? null : null);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 } });
      const track = s.getVideoTracks()[0];
      track.onended = () => {
        setSharing(null);
        void call.replaceVideo(camera ? stream?.getVideoTracks()[0] ?? null : null);
      };
      await call.replaceVideo(track);
      setSharing(track);
    } catch {}
  };

  const sendChat = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const res = (await room.send("chat", { text })) as { id: string; at: string } | null;
    if (res) setChat((c) => [...c, { id: res.id, from: me.id, text, at: res.at }]);
  };

  // Shared notes: saved and sent 0.7 s after the last keystroke
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editNotes = (text: string) => {
    setNotes(text);
    setNotesSaved(false);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      await room.send("notes", { text });
      setNotesSaved(true);
    }, 700);
  };

  const leave = () => {
    call.close();
    stream?.getTracks().forEach((tr) => tr.stop());
    router.push(backHref);
  };

  const connected = call.state === "connected";
  const showRemoteVideo = connected && peer.camera && !peer.audioOnly;
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const status = !online ? t("offline") : !room.connected ? t("reconnecting") : !otherHere ? t("waiting", { name: other.name }) : !connected ? t("connecting") : null;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-2 py-3 sm:px-4 lg:grid-cols-[1fr_380px]">
      {/* Video */}
      <section className="min-w-0 space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-lg)] bg-neutral-900">
          <video ref={remoteVideo} autoPlay playsInline data-testid="remote-video" className={cn("size-full object-contain", !showRemoteVideo && "invisible")} />
          {!showRemoteVideo && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center text-white">
              <div>
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/10 text-2xl font-semibold">
                  {other.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <p className="mt-3 text-sm text-white/80" role="status">
                  {status ?? (peer.audioOnly ? t("peerAudioOnly", { name: other.name }) : t("peerCameraOff", { name: other.name }))}
                </p>
              </div>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">{other.name}{!peer.mic && " 🔇"}</span>
          {connected && (
            <span
              className={cn(
                "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                call.quality === "poor" ? "bg-danger text-white" : call.quality === "fair" ? "bg-warning text-white" : "bg-black/50 text-white",
              )}
              data-testid="quality"
            >
              <Signal className="size-3.5" aria-hidden />
              {t(`quality.${call.quality}`)}
            </span>
          )}
          {/* Our own picture */}
          <div className="absolute bottom-3 right-3 aspect-video w-28 overflow-hidden rounded-[var(--radius-md)] border border-white/20 bg-neutral-800 sm:w-44">
            <video ref={localVideo} autoPlay muted playsInline className={cn("size-full object-cover", !sharing && "-scale-x-100", !camera && !sharing && "invisible")} />
            <span className="absolute bottom-1 left-1.5 text-[11px] text-white">{t("you")}</span>
          </div>
        </div>

        {call.quality === "poor" && !audioOnly && (
          <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2"><WifiLow className="size-4" aria-hidden />{t("poorHint")}</span>
            <Button size="sm" variant="secondary" onClick={toggleAudioOnly}>{t("switchAudioOnly")}</Button>
          </Alert>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2" role="toolbar">
          <Button variant={mic ? "secondary" : "danger"} onClick={toggleMic} disabled={!stream?.getAudioTracks().length} aria-pressed={!mic} aria-label={mic ? t("mute") : t("unmute")} title={mic ? t("mute") : t("unmute")}>
            {mic ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
          </Button>
          <Button variant={camera ? "secondary" : "danger"} onClick={() => setVideo(!camera)} disabled={audioOnly} aria-pressed={!camera} aria-label={camera ? t("cameraOff") : t("cameraOn")} title={camera ? t("cameraOff") : t("cameraOn")}>
            {camera ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
          </Button>
          {typeof navigator !== "undefined" && "getDisplayMedia" in (navigator.mediaDevices ?? {}) && (
            <Button variant={sharing ? "primary" : "secondary"} onClick={toggleShare} aria-pressed={Boolean(sharing)} aria-label={sharing ? t("stopShare") : t("share")} title={sharing ? t("stopShare") : t("share")}>
              {sharing ? <MonitorX className="size-5" aria-hidden /> : <MonitorUp className="size-5" aria-hidden />}
            </Button>
          )}
          <Button variant={audioOnly ? "primary" : "secondary"} onClick={toggleAudioOnly} aria-pressed={audioOnly}>
            {audioOnly ? t("videoOn") : t("audioOnly")}
          </Button>
          <Button variant="danger" onClick={leave}>
            <PhoneOff className="size-5" aria-hidden />
            {t("leave")}
          </Button>
        </div>
      </section>

      {/* Chat, whiteboard, notes */}
      <aside className="flex min-h-[420px] flex-col rounded-[var(--radius-lg)] border border-border bg-surface lg:h-[calc(100dvh-7rem)]">
        <div className="flex border-b border-border" role="tablist">
          {(["chat", "board", "notes"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => { setTab(k); if (k === "chat") setUnread(0); }}
              className={cn("flex-1 border-b-2 px-3 py-2.5 text-sm font-medium", tab === k ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg")}
            >
              {t(`tabs.${k}`)}
              {k === "chat" && unread > 0 && tab !== "chat" && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-fg">{unread}</span>}
            </button>
          ))}
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col", tab !== "chat" && "hidden")} role="tabpanel">
          <ul className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite" data-testid="chat-list">
            {chat.length === 0 && <li className="text-center text-sm text-muted">{t("noMessages")}</li>}
            {chat.map((m) => (
              <li key={m.id} className={cn("max-w-[85%] rounded-[var(--radius-md)] px-3 py-2 text-sm", m.from === me.id ? "ml-auto bg-primary text-primary-fg" : "bg-surface-2")}>
                {m.fileId ? (
                  <a href={`/api/files/${m.fileId}`} target="_blank" rel="noreferrer" className="underline">📎 {m.text}</a>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                )}
                <p className="mt-0.5 text-[11px] opacity-70">{time(m.at)}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border p-3">
            <form onSubmit={(e) => { e.preventDefault(); void sendChat(); }} className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("chatPlaceholder")}
                aria-label={t("chatPlaceholder")}
                maxLength={2000}
                className="h-10 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
              <Button type="submit" size="sm" className="h-10" aria-label={t("send")}><Send className="size-4" aria-hidden /></Button>
            </form>
            <FileUpload
              kind="LESSON_FILE"
              label={t("attach")}
              onUploaded={async (doc) => {
                const name = doc.name.slice(0, 200);
                const res = (await room.send("file", { docId: doc.id, name })) as { id: string; at: string } | null;
                if (res) setChat((c) => [...c, { id: res.id, from: me.id, text: name, fileId: doc.id, at: res.at }]);
              }}
            />
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-3", tab !== "board" && "hidden")} role="tabpanel">
          <Whiteboard ref={board} initial={initial.strokes} send={(type, payload) => void room.send(type, payload)} />
        </div>

        <div className={cn("flex flex-1 flex-col gap-2 p-3", tab !== "notes" && "hidden")} role="tabpanel">
          <p className="flex justify-between text-xs text-muted">
            <span>{t("notesHint", { name: other.name })}</span>
            {notesSaved && <span>{t("notesSaved")}</span>}
          </p>
          <textarea
            value={notes}
            onChange={(e) => editNotes(e.target.value)}
            aria-label={t("tabs.notes")}
            maxLength={20000}
            className="min-h-48 flex-1 resize-none rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </aside>
    </div>
  );
}
