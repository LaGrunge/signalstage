import { Server } from "@hocuspocus/server";
import { roomExists, getRoomInitialCode } from "./db.js";

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
  });

  server.listen();
  console.log(`Hocuspocus collab server listening on :${process.env.COLLAB_PORT || 1234}`);
  return server;
}
