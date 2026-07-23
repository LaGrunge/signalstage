import { Server } from "@hocuspocus/server";
import { pool, roomExists, getRoomInitialCode } from "./db.js";

let hocuspocusServer = null;

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
    // the room's snapshotted template code, if any, before the first client
    // attaches - guarded on emptiness so a mid-session server restart never
    // clobbers real candidate code with the original template again.
    async onLoadDocument({ documentName, document }) {
      const initialCode = await getRoomInitialCode(documentName);
      const ytext = document.getText("code");
      if (initialCode && ytext.length === 0) {
        ytext.insert(0, initialCode);
      }
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
  });

  server.listen();
  hocuspocusServer = server;
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
