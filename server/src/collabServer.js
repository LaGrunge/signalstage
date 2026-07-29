import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { pool, roomExists, getRoomInitialCode } from "./db.js";

let hocuspocusServer = null;

// Playback recording buffer: documentName -> [{ts, actor, update: Buffer}].
// onChange fires per editor transaction (keystroke-ish), so rows are
// buffered here and flushed in one multi-row INSERT every FLUSH_MS (and
// right before a document unloads). Crash tolerance: an ungraceful kill
// loses at most FLUSH_MS of keystrokes - same durability class as the
// debounced rooms.last_code snapshot, accepted for this product.
const updateBuffers = new Map();
const FLUSH_MS = 3000;

// Per-room promise chain: yjs_updates ordering rides on BIGSERIAL ids, so
// two overlapping flushes of the same room (a slow INSERT still in flight
// when the next interval fires) must not race each other's id assignment.
const flushChains = new Map();

function flushRoom(documentName) {
  const chained = (flushChains.get(documentName) ?? Promise.resolve()).then(async () => {
    const buffered = updateBuffers.get(documentName);
    if (!buffered || buffered.length === 0) return;
    updateBuffers.set(documentName, []);
    try {
      await pool.query(
        `INSERT INTO yjs_updates (room_id, actor, update, is_keyframe, created_at)
         SELECT $1, a, u, k, t
         FROM unnest($2::text[], $3::bytea[], $4::bool[], $5::timestamptz[]) AS x(a, u, k, t)`,
        [
          documentName,
          buffered.map((b) => b.actor),
          buffered.map((b) => b.update),
          buffered.map((b) => Boolean(b.keyframe)),
          buffered.map((b) => b.ts),
        ]
      );
    } catch (err) {
      // Drop rather than re-queue: an unreachable DB must not grow the buffer
      // without bound, and losing a flush window degrades playback, not the
      // live session.
      console.error(`playback: dropped ${buffered.length} updates for ${documentName}:`, err.message);
    }
  });
  flushChains.set(documentName, chained);
  return chained;
}

function flushAll() {
  for (const documentName of updateBuffers.keys()) {
    flushRoom(documentName);
  }
}

async function recordRoomEvent(roomId, kind, actor) {
  try {
    await pool.query("INSERT INTO room_events (room_id, kind, actor) VALUES ($1, $2, $3)", [
      roomId,
      kind,
      actor ?? null,
    ]);
  } catch (err) {
    console.error(`playback: failed to record ${kind} for ${roomId}:`, err.message);
  }
}

export function startCollabServer() {
  const server = Server.configure({
    port: Number(process.env.COLLAB_PORT || 1234),

    // documentName === roomId. Reject anyone whose link doesn't correspond to
    // an active room instead of letting them open an arbitrary Yjs doc.
    async onAuthenticate({ documentName, token }) {
      if (!(await roomExists(documentName))) {
        throw new Error("unknown or inactive room");
      }
      return { name: token || "Anonymous" };
    },

    // Called once when a document first loads into memory (no persistence
    // extension is configured, so this is always "brand new"). Seed it from
    // the room's last stored snapshot (falling back to the template code -
    // see getRoomInitialCode) before the first client attaches, so a session
    // where everyone briefly disconnected resumes with its real code instead
    // of resetting to the template. Guarded on emptiness so a reload never
    // clobbers a doc that somehow already has content.
    async onLoadDocument({ documentName, document }) {
      const initialCode = await getRoomInitialCode(documentName);
      const ytext = document.getText("code");
      if (initialCode && ytext.length === 0) {
        ytext.insert(0, initialCode);
      }
      // Playback keyframe: full state snapshot at (re)load time. Client
      // updates causally depend on the seed insert above (which onChange
      // never sees), and every unload+reload starts a fresh Yjs history -
      // replay must reset to a fresh Y.Doc at each keyframe, so recording
      // one per load is what keeps multi-segment sessions replayable.
      let buffered = updateBuffers.get(documentName);
      if (!buffered) {
        buffered = [];
        updateBuffers.set(documentName, buffered);
      }
      buffered.push({
        ts: new Date(),
        actor: null,
        update: Buffer.from(Y.encodeStateAsUpdate(document)),
        keyframe: true,
      });
      return document;
    },

    // Hocuspocus debounces this itself (a few seconds after edits settle) and
    // also fires it once more right before unloading an idle document, so
    // this is the last chance to persist its content before the in-memory
    // doc disappears - store both the activity timestamp and a text
    // snapshot (dashboard previews fall back to this once nobody's connected
    // and Hocuspocus has evicted the live document).
    async onStoreDocument({ documentName, document }) {
      const code = document.getText("code").toString();
      await pool.query(
        "UPDATE rooms SET last_active_at = now(), last_code = $2 WHERE id = $1",
        [documentName, code]
      );
    },

    // Playback recording: buffer every Yjs update with its capture time and
    // author (context is whatever onAuthenticate returned - {name}). The
    // onLoadDocument template seed above also lands here (actor null, since
    // it's a server-local transaction) - deliberately recorded, so playback
    // opens with the template appearing exactly like the session did.
    async onChange({ documentName, context, update }) {
      let buffered = updateBuffers.get(documentName);
      if (!buffered) {
        buffered = [];
        updateBuffers.set(documentName, buffered);
      }
      buffered.push({ ts: new Date(), actor: context?.name ?? null, update: Buffer.from(update) });
    },

    async connected({ documentName, context }) {
      await recordRoomEvent(documentName, "join", context?.name);
    },

    async onDisconnect({ documentName, context }) {
      await recordRoomEvent(documentName, "leave", context?.name);
    },

    async beforeUnloadDocument({ documentName }) {
      await flushRoom(documentName);
      updateBuffers.delete(documentName);
      flushChains.delete(documentName);
    },
  });

  server.listen();
  hocuspocusServer = server;
  setInterval(flushAll, FLUSH_MS);
  console.log(`Hocuspocus collab server listening on :${process.env.COLLAB_PORT || 1234}`);
  return server;
}

// Returns the live in-memory Y.Doc for a room if Hocuspocus currently has it
// loaded (i.e. someone has connected to it since this process started), so
// dashboard card previews can reflect real-time content rather than only the
// initial template snapshot. Returns undefined if never loaded/evicted.
export function getLiveDocument(roomId) {
  return hocuspocusServer?.documents.get(roomId);
}

// Live count of currently-connected participants, for the dashboard's card
// footer icon - 0 (not undefined) when the document was never loaded/has been
// evicted, since "nobody connected" and "no data" look the same to the UI.
export function getRoomParticipantCount(roomId) {
  return hocuspocusServer?.documents.get(roomId)?.getConnectionsCount() ?? 0;
}
