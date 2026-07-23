// End-to-end verification against a live SignalStage deployment: for every
// language exposed by the API, (1) it's actually listed, (2) a real
// compile+run round-trip through /api/execute produces the expected output,
// and (3) the LSP bridge completes a real `initialize` handshake (not just a
// websocket upgrade - see lsp/bridge.js's comments on why that alone proves
// nothing about whether the underlying language server actually started).
//
// Usage: SIGNALSTAGE_URL=http://your-host npm test   (defaults to http://localhost)
// If the deployment sits behind nginx Basic Auth (see README "Security and
// production checklist"), also set SIGNALSTAGE_BASIC_AUTH=user:pass, or every
// request below 401s before it ever reaches the app.
import { WebSocket } from "ws";

const HTTP = process.env.SIGNALSTAGE_URL || "http://localhost";
const WS_BASE = HTTP.replace(/^http/, "ws");
const BASIC_AUTH = process.env.SIGNALSTAGE_BASIC_AUTH
  ? { Authorization: `Basic ${Buffer.from(process.env.SIGNALSTAGE_BASIC_AUTH).toString("base64")}` }
  : {};

const LANGUAGES = [
  { key: "cpp", code: '#include <iostream>\nint main(){std::cout<<"ok";return 0;}', expect: "ok" },
  { key: "python", code: "print('ok')", expect: "ok" },
  { key: "go", code: 'package main\nimport "fmt"\nfunc main(){fmt.Print("ok")}', expect: "ok" },
  { key: "java", code: 'public class Main { public static void main(String[] a){ System.out.print("ok"); } }', expect: "ok" },
  { key: "bash", code: "printf ok", expect: "ok" },
  { key: "mariadb", code: "SELECT 'ok' AS result;", expect: "ok" },
];

let passed = 0;
let failed = 0;

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? `: ${detail}` : ""}`);
  ok ? passed++ : failed++;
}

function checkLsp(langKey) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_BASE}/lsp/${langKey}`, { headers: BASIC_AUTH });
    // jdtls (Java) is slow to boot (OSGi framework + plugin registration) -
    // give it real headroom rather than a timeout tuned for the fast servers.
    const timeout = setTimeout(() => {
      ws.terminate();
      resolve(false);
    }, 45_000);

    ws.on("open", () => {
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { processId: null, rootUri: "file:///workspace", capabilities: {} },
      });
      ws.send(Buffer.concat([Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`), Buffer.from(body)]));
    });

    // Servers like jdtls send unsolicited notifications (window/logMessage,
    // language/status, ...) before the actual initialize response - keep
    // parsing frames out of the buffer in a loop and only settle on the one
    // that's actually our response (id === 1), not the first frame that
    // happens to arrive.
    let buffer = Buffer.alloc(0);
    ws.on("message", (data) => {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(data) ? data : Buffer.from(data)]);
      for (;;) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const match = /Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString("ascii"));
        if (!match) return;
        const bodyStart = headerEnd + 4;
        const length = Number(match[1]);
        if (buffer.length < bodyStart + length) return;
        const frame = buffer.subarray(bodyStart, bodyStart + length);
        buffer = buffer.subarray(bodyStart + length);
        try {
          const msg = JSON.parse(frame.toString("utf8"));
          if (msg.id === 1) {
            clearTimeout(timeout);
            ws.close();
            resolve(Boolean(msg.result?.capabilities));
            return;
          }
        } catch {
          // Ignore an unparseable frame and keep waiting for the real one.
        }
      }
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function main() {
  const email = `system-check-${Date.now()}@test.local`;
  const registerRes = await fetch(`${HTTP}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...BASIC_AUTH },
    body: JSON.stringify({ email, password: "system-check-password-123", name: "System Check" }),
  });
  if (!registerRes.ok) throw new Error(`register failed: HTTP ${registerRes.status}`);
  const { token } = await registerRes.json();
  const auth = { "X-SignalStage-Token": token, ...BASIC_AUTH };

  const room = await fetch(`${HTTP}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ title: "system-check" }),
  }).then((r) => r.json());

  const languages = await fetch(`${HTTP}/api/languages`, { headers: BASIC_AUTH }).then((r) => r.json());
  const exposedKeys = new Set(languages.map((l) => l.key));
  for (const lang of LANGUAGES) {
    report(`GET /api/languages exposes "${lang.key}"`, exposedKeys.has(lang.key));
  }

  for (const lang of LANGUAGES) {
    const res = await fetch(`${HTTP}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...BASIC_AUTH },
      body: JSON.stringify({ roomId: room.id, language: lang.key, code: lang.code, stdin: "" }),
    }).then((r) => r.json());
    const ok = res.status?.description === "Accepted" && (res.stdout || "").includes(lang.expect);
    report(`execute ${lang.key}`, ok, ok ? undefined : JSON.stringify(res).slice(0, 200));
  }

  // mariadb has no LSP entry at all (see lsp/bridge.js) - sql-language-server
  // is broken on every currently-installable version, a real upstream
  // package issue, not something to silently mark green here.
  for (const lang of LANGUAGES.filter((l) => l.key !== "mariadb")) {
    report(`lsp ${lang.key} initialize`, await checkLsp(lang.key));
  }

  await fetch(`${HTTP}/api/rooms/${room.id}`, { method: "DELETE", headers: auth });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
