import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

// The browser never learns the real per-session temp directory - it always
// speaks in terms of this fixed placeholder root, and the bridge rewrites
// file:// URIs both ways as messages pass through. That's what lets a plain
// WebSocket + a hand-rolled LSP client on the frontend (no monaco-vscode-api)
// talk to a language server that expects a real on-disk rootUri.
const PLACEHOLDER_ROOT = "file:///workspace";

const LANGUAGES = {
  cpp: {
    filename: "main.cpp",
    spawn: (dir) => spawn("clangd", ["--log=error", "--pretty"], { cwd: dir }),
  },
  python: {
    filename: "main.py",
    spawn: (dir) => spawn("pylsp", [], { cwd: dir }),
  },
  go: {
    filename: "main.go",
    prepare: (dir) => fs.writeFileSync(path.join(dir, "go.mod"), "module session\n\ngo 1.22\n"),
    spawn: (dir) => spawn("gopls", ["serve"], { cwd: dir, env: { ...process.env, GOFLAGS: "-mod=mod" } }),
  },
  java: {
    filename: "Main.java",
    spawn: (dir) => {
      const dataDir = path.join(dir, ".jdt-data");
      fs.mkdirSync(dataDir, { recursive: true });
      return spawn("/opt/jdtls/bin/jdtls", ["-data", dataDir], { cwd: dir });
    },
  },
};

class MessageFramer {
  constructor(onMessage) {
    this.buffer = Buffer.alloc(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length: (\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;

      this.onMessage(this.buffer.subarray(bodyStart, bodyStart + length));
      this.buffer = this.buffer.subarray(bodyStart + length);
    }
  }
}

function frame(body) {
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

function rewrite(body, from, to) {
  if (!body.includes(from)) return body;
  return Buffer.from(body.toString("utf8").split(from).join(to), "utf8");
}

function handleConnection(ws, langKey) {
  const lang = LANGUAGES[langKey];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-"));
  const realRootUri = `file://${tempDir}`;

  fs.writeFileSync(path.join(tempDir, lang.filename), "");
  lang.prepare?.(tempDir);

  let child;
  try {
    child = lang.spawn(tempDir);
  } catch (err) {
    console.error(`[${langKey}] failed to spawn language server:`, err.message);
    ws.close(1011, "language server unavailable");
    fs.rm(tempDir, { recursive: true, force: true }, () => {});
    return;
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    child.kill();
    fs.rm(tempDir, { recursive: true, force: true }, () => {});
  };

  child.on("error", (err) => {
    console.error(`[${langKey}] language server error:`, err.message);
    try {
      ws.close(1011, "language server crashed");
    } catch {}
    cleanup();
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`[${langKey}] language server exited with code ${code}`);
    try {
      ws.close();
    } catch {}
    cleanup();
  });
  child.stderr.on("data", (chunk) => process.stderr.write(`[${langKey}] ${chunk}`));

  const toChild = new MessageFramer((body) => {
    if (child.stdin.writable) child.stdin.write(frame(rewrite(body, PLACEHOLDER_ROOT, realRootUri)));
  });
  ws.on("message", (data) => toChild.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));

  const toClient = new MessageFramer((body) => {
    if (ws.readyState === ws.OPEN) ws.send(frame(rewrite(body, realRootUri, PLACEHOLDER_ROOT)));
  });
  child.stdout.on("data", (chunk) => toClient.push(chunk));

  ws.on("close", cleanup);
  ws.on("error", cleanup);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const match = /^\/lsp\/(cpp|python|go|java)$/.exec(req.url);
  if (!match) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws, match[1]));
});

const port = Number(process.env.PORT || 3001);
server.listen(port, () => console.log(`LSP bridge listening on :${port}`));
