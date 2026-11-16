import "server-only";

/**
 * STUN/TURN servers for the video calls. STUN lets two browsers find each other;
 * a TURN server relays the call when a network blocks direct connections (some mobile
 * and office networks do). Set TURN_URL / TURN_USERNAME / TURN_CREDENTIAL to add one,
 * or ICE_SERVERS to a full JSON list.
 */
export function iceServers(): RTCIceServer[] {
  if (process.env.ICE_SERVERS) {
    try {
      return JSON.parse(process.env.ICE_SERVERS);
    } catch {}
  }
  const list: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  if (process.env.TURN_URL) {
    list.push({ urls: process.env.TURN_URL.split(","), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return list;
}
