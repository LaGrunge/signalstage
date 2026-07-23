import { Server } from "@hocuspocus/server";
import { roomExists } from "./db.js";

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
  });

  server.listen();
  console.log(`Hocuspocus collab server listening on :${process.env.COLLAB_PORT || 1234}`);
  return server;
}
