import "server-only";

/**
 * Live messages for lesson rooms (chat, whiteboard, notes, presence, WebRTC signalling),
 * delivered over Server-Sent Events.
 *
 * This hub lives in the memory of one server process. That is right for a single server.
 * If the site ever runs on several servers at once, replace `publish` with Redis pub/sub
 * so every server sees every message.
 */
export type RoomEvent = { type: string; from: string; to?: string; payload?: unknown; at: string };
type Client = { userId: string; send: (e: RoomEvent) => void };

const g = globalThis as unknown as { __lqRooms?: Map<string, Set<Client>> };
const rooms = (g.__lqRooms ??= new Map());

export function subscribe(room: string, client: Client) {
  let set = rooms.get(room);
  if (!set) rooms.set(room, (set = new Set()));
  set.add(client);
  return () => {
    set!.delete(client);
    if (!set!.size) rooms.delete(room);
  };
}

/** Send to everyone in the room, or only to `to` when set (e.g. WebRTC offers). Never echoes to the sender. */
export function publish(room: string, event: Omit<RoomEvent, "at">) {
  const e = { ...event, at: new Date().toISOString() };
  for (const c of rooms.get(room) ?? []) {
    if (c.userId === event.from) continue;
    if (event.to && c.userId !== event.to) continue;
    c.send(e);
  }
}

/** Who is connected right now (user ids). */
export function present(room: string) {
  return [...new Set([...(rooms.get(room) ?? [])].map((c) => c.userId))];
}
