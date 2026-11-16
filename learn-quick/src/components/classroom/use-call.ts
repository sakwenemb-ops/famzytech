"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Quality = "good" | "fair" | "poor" | "unknown";
export type PeerMedia = { camera: boolean; mic: boolean; audioOnly: boolean; sharing: boolean };

/** Video is capped for mobile data: about 400 kbit/s at 24 frames per second. */
const MAX_VIDEO_BITRATE = 400_000;

/**
 * One-to-one WebRTC call between the student and the teacher, using "perfect negotiation"
 * (the student is the polite peer) so both can join in any order without glare.
 * Signalling (offers, answers, ICE candidates) travels through the lesson room.
 */
export function useCall(opts: {
  polite: boolean;
  iceServers: RTCIceServer[];
  localStream: MediaStream | null;
  sendSignal: (payload: { description?: RTCSessionDescriptionInit | null; candidate?: RTCIceCandidateInit | null }) => void;
}) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const videoSender = useRef<RTCRtpSender | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<RTCPeerConnectionState>("new");
  const [quality, setQuality] = useState<Quality>("unknown");
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const close = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    videoSender.current = null;
    setRemoteStream(null);
    setState("closed");
    setQuality("unknown");
  }, []);

  /** (Re)start the connection: called when the other person is (or arrives) in the room. */
  const start = useCallback(() => {
    pcRef.current?.close();
    const { iceServers, localStream } = optsRef.current;
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    const remote = new MediaStream();
    setRemoteStream(remote);

    for (const track of localStream?.getTracks() ?? []) {
      const sender = pc.addTrack(track, localStream!);
      if (track.kind === "video") {
        videoSender.current = sender;
        cameraTrack.current = track;
      }
    }
    // Always negotiate a video slot, so a camera turned on later (or screen sharing) needs no renegotiation
    if (!videoSender.current) videoSender.current = pc.addTransceiver("video", { direction: "sendrecv" }).sender;

    pc.ontrack = (e) => {
      remote.addTrack(e.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
      e.track.onunmute = () => setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        optsRef.current.sendSignal({ description: pc.localDescription?.toJSON() });
      } finally {
        makingOffer.current = false;
      }
    };
    pc.onicecandidate = (e) => optsRef.current.sendSignal({ candidate: e.candidate?.toJSON() ?? null });
    pc.onconnectionstatechange = () => {
      setState(pc.connectionState);
      if (pc.connectionState === "connected") void capBitrate();
      if (pc.connectionState === "failed") pc.restartIce();
    };
  }, []);

  async function capBitrate() {
    const sender = videoSender.current;
    if (!sender) return;
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
    params.encodings[0].maxFramerate = 24;
    await sender.setParameters(params).catch(() => undefined);
  }

  /** Handle an offer / answer / ICE candidate from the other side. */
  const onSignal = useCallback(async (payload: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }) => {
    const pc = pcRef.current;
    if (!pc) return;
    const { description, candidate } = payload;
    if (description) {
      const collision = description.type === "offer" && (makingOffer.current || pc.signalingState !== "stable");
      ignoreOffer.current = !optsRef.current.polite && collision;
      if (ignoreOffer.current) return;
      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        optsRef.current.sendSignal({ description: pc.localDescription?.toJSON() });
      }
    } else if (candidate !== undefined) {
      try {
        await pc.addIceCandidate(candidate ?? undefined);
      } catch (e) {
        if (!ignoreOffer.current) console.warn("ICE candidate", e);
      }
    }
  }, []);

  /** Send a different video (screen sharing) or none (camera off, audio only). */
  const replaceVideo = useCallback(async (track: MediaStreamTrack | null) => {
    await videoSender.current?.replaceTrack(track).catch(() => undefined);
  }, []);

  // Connection quality from round-trip time and packet loss, every 3 seconds
  useEffect(() => {
    let lastLost = 0, lastRecv = 0;
    const id = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== "connected") return;
      const stats = await pc.getStats();
      let rtt = 0, lost = 0, recv = 0;
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && r.nominated) rtt = r.currentRoundTripTime ?? rtt;
        if (r.type === "inbound-rtp") {
          lost += r.packetsLost ?? 0;
          recv += r.packetsReceived ?? 0;
        }
      });
      const dl = lost - lastLost, dr = recv - lastRecv;
      lastLost = lost;
      lastRecv = recv;
      const loss = dr + dl > 0 ? dl / (dr + dl) : 0;
      setQuality(rtt > 0.6 || loss > 0.08 ? "poor" : rtt > 0.3 || loss > 0.03 ? "fair" : "good");
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => close, [close]);

  return { start, close, onSignal, replaceVideo, remoteStream, state, quality, cameraTrack };
}
