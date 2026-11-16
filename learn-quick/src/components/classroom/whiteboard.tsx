"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser, Pen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Stroke = { id: string; tool: "pen" | "eraser"; color: string; size: number; points: [number, number][] };
export type WhiteboardHandle = { remoteLive: (s: Stroke) => void; remoteStroke: (s: Stroke) => void; remoteClear: () => void };

const COLORS = ["#17181c", "#2148c0", "#c4282d", "#13804b"];
const uid = () => Math.random().toString(36).slice(2, 12);

/**
 * Shared whiteboard. Points are stored from 0 to 1 so the drawing fits any screen.
 * While drawing, the stroke is sent live (not saved); when the pen lifts, the finished
 * stroke is sent and saved with the lesson.
 */
export const Whiteboard = forwardRef<WhiteboardHandle, { initial: Stroke[]; send: (type: string, payload?: unknown) => void; readOnly?: boolean }>(
  function Whiteboard({ initial, send, readOnly = false }, ref) {
    const t = useTranslations("classroom");
    const canvas = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Stroke[]>(initial);
    const live = useRef<Map<string, Stroke>>(new Map());
    const current = useRef<Stroke | null>(null);
    const lastSent = useRef(0);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [color, setColor] = useState(COLORS[1]);

    const draw = useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      const all = [...strokes.current, ...live.current.values(), ...(current.current ? [current.current] : [])];
      for (const s of all) {
        ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
        ctx.lineWidth = (s.tool === "eraser" ? s.size * 4 : s.size) * (c.width / 800);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.width, y * c.height) : ctx.moveTo(x * c.width, y * c.height)));
        if (s.points.length === 1) ctx.lineTo(s.points[0][0] * c.width + 0.1, s.points[0][1] * c.height);
        ctx.stroke();
      }
    }, []);

    // Keep the canvas sharp at its displayed size
    useEffect(() => {
      const c = canvas.current!;
      const resize = () => {
        const r = c.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
        draw();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(c);
      return () => ro.disconnect();
    }, [draw]);

    useImperativeHandle(ref, () => ({
      remoteLive: (s) => {
        live.current.set(s.id, s);
        draw();
      },
      remoteStroke: (s) => {
        live.current.delete(s.id);
        if (!strokes.current.some((x) => x.id === s.id)) strokes.current.push(s);
        draw();
      },
      remoteClear: () => {
        strokes.current = [];
        live.current.clear();
        draw();
      },
    }), [draw]);

    const point = (e: React.PointerEvent): [number, number] => {
      const r = canvas.current!.getBoundingClientRect();
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
    };

    const down = (e: React.PointerEvent) => {
      if (readOnly) return;
      canvas.current!.setPointerCapture(e.pointerId);
      current.current = { id: uid(), tool, color, size: 3, points: [point(e)] };
      draw();
    };
    const move = (e: React.PointerEvent) => {
      const s = current.current;
      if (!s || s.points.length >= 600) return;
      s.points.push(point(e));
      draw();
      // Send the stroke so far about 15 times a second
      if (Date.now() - lastSent.current > 66) {
        lastSent.current = Date.now();
        send("wb-live", s);
      }
    };
    const up = () => {
      const s = current.current;
      if (!s) return;
      current.current = null;
      strokes.current.push(s);
      draw();
      send("wb", s);
    };

    return (
      <div className="flex h-full flex-col gap-2">
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("tabs.board")}>
            <button type="button" aria-pressed={tool === "pen"} aria-label={t("pen")} onClick={() => setTool("pen")} className={cn("grid size-9 place-items-center rounded-[var(--radius-sm)] border", tool === "pen" ? "border-primary bg-primary-soft" : "border-border")}>
              <Pen className="size-4" aria-hidden />
            </button>
            <button type="button" aria-pressed={tool === "eraser"} aria-label={t("eraser")} onClick={() => setTool("eraser")} className={cn("grid size-9 place-items-center rounded-[var(--radius-sm)] border", tool === "eraser" ? "border-primary bg-primary-soft" : "border-border")}>
              <Eraser className="size-4" aria-hidden />
            </button>
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={t("color", { n: i + 1 })}
                aria-pressed={color === c && tool === "pen"}
                onClick={() => { setColor(c); setTool("pen"); }}
                className={cn("size-7 rounded-full border-2", color === c && tool === "pen" ? "border-fg" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
            <button
              type="button"
              aria-label={t("clear")}
              title={t("clear")}
              onClick={() => { strokes.current = []; live.current.clear(); draw(); send("wb-clear"); }}
              className="ml-auto grid size-9 place-items-center rounded-[var(--radius-sm)] border border-border text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <canvas
          ref={canvas}
          data-testid="whiteboard"
          aria-label={t("tabs.board")}
          className="aspect-[4/3] w-full touch-none rounded-[var(--radius-md)] border border-border bg-white"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
    );
  },
);
