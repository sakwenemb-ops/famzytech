"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

/** Camera 640×360 at up to 24 fps: clear enough for a lesson, light on mobile data. */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 24 } };
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** Check camera, microphone and speaker before joining, then hand the stream to the call. */
export function PreJoin({ onJoin }: { onJoin: (stream: MediaStream | null, audioOnly: boolean) => void }) {
  const t = useTranslations("classroom");
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<"denied" | "none" | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [level, setLevel] = useState(0);

  // Open the chosen devices
  useEffect(() => {
    let cancelled = false;
    let s: MediaStream | null = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { ...VIDEO_CONSTRAINTS, ...(camId ? { deviceId: { exact: camId } } : {}) },
          audio: { ...AUDIO_CONSTRAINTS, ...(micId ? { deviceId: { exact: micId } } : {}) },
        });
      } catch (e) {
        // No camera? Try the microphone alone
        try {
          s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        } catch {
          if (!cancelled) setError((e as DOMException).name === "NotAllowedError" ? "denied" : "none");
          return;
        }
      }
      if (cancelled) return s.getTracks().forEach((tr) => tr.stop());
      setError(null);
      setStream(s);
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.deviceId && (d.kind === "videoinput" || d.kind === "audioinput")));
    })();
    return () => {
      cancelled = true;
    };
  }, [camId, micId]);

  // The stream handed to the call must keep running; any other stream is stopped when replaced
  const handed = useRef<MediaStream | null>(null);
  useEffect(() => () => {
    if (stream && stream !== handed.current) stream.getTracks().forEach((tr) => tr.stop());
  }, [stream]);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  // Microphone level meter
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [stream]);

  const beep = () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    osc.frequency.value = 660;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => void ctx.close();
  };

  const join = (audioOnly: boolean) => {
    const s = stream;
    handed.current = s;
    if (s && audioOnly) s.getVideoTracks().forEach((tr) => { tr.stop(); s.removeTrack(tr); });
    onJoin(s, audioOnly || !s?.getVideoTracks().length);
  };

  const cams = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{t("precheck")}</h2>
        <p className="mt-1 text-sm text-muted">{t("precheckHint")}</p>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-lg)] bg-black">
        <video ref={video} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" data-testid="preview-video" />
        {!hasVideo && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">{t("cameraOff")}</p>}
      </div>
      {error && <Alert tone="warning">{error === "denied" ? t("permissionDenied") : t("noDevice")}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {cams.length > 1 && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("camera")}</span>
            <Select value={camId} onChange={(e) => setCamId(e.target.value)}>
              {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t("camera")} ${i + 1}`}</option>)}
            </Select>
          </label>
        )}
        {mics.length > 1 && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("microphone")}</span>
            <Select value={micId} onChange={(e) => setMicId(e.target.value)}>
              {mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t("microphone")} ${i + 1}`}</option>)}
            </Select>
          </label>
        )}
      </div>
      {stream?.getAudioTracks().length ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">{t("micLevel")}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={t("micLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
            <div className="h-full bg-success transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={beep}>
            <Volume2 className="size-4" aria-hidden />
            {t("testSpeaker")}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {stream ? (
          <>
            <Button size="lg" onClick={() => join(false)}>{t("join")}</Button>
            {hasVideo && <Button size="lg" variant="secondary" onClick={() => join(true)}>{t("joinAudioOnly")}</Button>}
          </>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => onJoin(null, true)}>{t("joinNoDevices")}</Button>
        )}
      </div>
    </div>
  );
}
