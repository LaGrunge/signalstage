// Minimal hand-rolled LSP client over a plain WebSocket, talking to
// lsp/bridge.js on the backend. We deliberately did not pull in
// monaco-languageclient/@codingame/monaco-vscode-api: that stack reimplements
// large parts of the VS Code workbench (services, extension host shims) to
// give Monaco a "real" LSP client, which is a lot of fast-moving, tightly
// version-locked dependency surface for what we actually need here -
// diagnostics, completion, and hover on a plain <Editor>. This file wires
// those three LSP features straight into Monaco's own provider APIs instead.

const LSP_COMPLETION_KIND = [
  null, // LSP kinds are 1-indexed
  "Text",
  "Method",
  "Function",
  "Constructor",
  "Field",
  "Variable",
  "Class",
  "Interface",
  "Module",
  "Property",
  "Unit",
  "Value",
  "Enum",
  "Keyword",
  "Snippet",
  "Color",
  "File",
  "Reference",
  "Folder",
  "EnumMember",
  "Constant",
  "Struct",
  "Event",
  "Operator",
  "TypeParameter",
];

const LSP_SEVERITY = [null, "Error", "Warning", "Info", "Hint"];

function toLspPosition(position) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function toMonacoRange(monacoNS, range) {
  return new monacoNS.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1
  );
}

function hoverContentsToStrings(contents) {
  if (!contents) return [];
  const list = Array.isArray(contents) ? contents : [contents];
  return list.map((c) => {
    if (typeof c === "string") return c;
    if (c.language !== undefined) return "```" + c.language + "\n" + c.value + "\n```";
    return c.value ?? "";
  });
}

class MessageFramer {
  constructor(onMessage) {
    this.buffer = new Uint8Array(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    const bytes = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk;
    const merged = new Uint8Array(this.buffer.length + bytes.length);
    merged.set(this.buffer, 0);
    merged.set(bytes, this.buffer.length);
    this.buffer = merged;

    for (;;) {
      const text = new TextDecoder("ascii").decode(this.buffer.subarray(0, Math.min(this.buffer.length, 200)));
      const headerEndRel = text.indexOf("\r\n\r\n");
      if (headerEndRel === -1) return;

      const match = /Content-Length: (\d+)/i.exec(text.slice(0, headerEndRel));
      if (!match) {
        this.buffer = this.buffer.subarray(headerEndRel + 4);
        continue;
      }

      const length = Number(match[1]);
      const bodyStart = headerEndRel + 4;
      if (this.buffer.length < bodyStart + length) return;

      const body = this.buffer.subarray(bodyStart, bodyStart + length);
      this.onMessage(JSON.parse(new TextDecoder("utf8").decode(body)));
      this.buffer = this.buffer.subarray(bodyStart + length);
    }
  }
}

function encodeMessage(obj) {
  const bodyBytes = new TextEncoder().encode(JSON.stringify(obj));
  const headerBytes = new TextEncoder().encode(`Content-Length: ${bodyBytes.length}\r\n\r\n`);
  const full = new Uint8Array(headerBytes.length + bodyBytes.length);
  full.set(headerBytes, 0);
  full.set(bodyBytes, headerBytes.length);
  return full;
}

// Connects to the bridge for a single language, registers Monaco providers
// for the lifetime of the connection, and cleans everything up on dispose().
// `model` is fixed for the lifetime of one connection - switching the room's
// language means the caller disposes this and calls connectLsp again with
// the new language, it does not mutate an existing connection in place.
export function connectLsp({ url, languageId, monacoNS, model }) {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  const uri = "file:///workspace/" + model.uri.path.replace(/^\//, "");
  let nextId = 1;
  const pending = new Map();
  let version = 1;
  let disposed = false;
  const disposables = [];

  function send(obj) {
    if (ws.readyState === WebSocket.OPEN) ws.send(encodeMessage(obj));
  }

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  function notify(method, params) {
    send({ jsonrpc: "2.0", method, params });
  }

  const framer = new MessageFramer((msg) => {
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || "LSP error"));
      else p.resolve(msg.result);
      return;
    }

    if (msg.method === "textDocument/publishDiagnostics") {
      if (msg.params.uri !== uri) return;
      const markers = (msg.params.diagnostics || []).map((d) => ({
        severity: monacoNS.MarkerSeverity[LSP_SEVERITY[d.severity] || "Warning"],
        message: d.message,
        ...toMonacoRange(monacoNS, d.range),
      }));
      monacoNS.editor.setModelMarkers(model, "lsp", markers);
      return;
    }

    // Server-initiated request (registerCapability, workspace/configuration,
    // workDoneProgress/create, ...) - we don't implement any of these, but
    // must answer something or well-behaved servers will stall waiting.
    if (msg.method && msg.id !== undefined) {
      const result = msg.method === "workspace/configuration" ? (msg.params.items || []).map(() => null) : null;
      send({ jsonrpc: "2.0", id: msg.id, result });
    }
  });

  ws.addEventListener("message", (event) => framer.push(event.data));

  ws.addEventListener("open", async () => {
    try {
      await request("initialize", {
        processId: null,
        rootUri: "file:///workspace",
        capabilities: {
          textDocument: {
            synchronization: { didSave: false },
            completion: { completionItem: { snippetSupport: false } },
            hover: { contentFormat: ["markdown", "plaintext"] },
            publishDiagnostics: {},
          },
        },
        workspaceFolders: null,
      });
    } catch {
      return;
    }
    if (disposed) return;
    notify("initialized", {});
    notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text: model.getValue() },
    });
  });

  const changeListener = model.onDidChangeContent(() => {
    version += 1;
    notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text: model.getValue() }],
    });
  });
  disposables.push(changeListener);

  disposables.push(
    monacoNS.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: [".", ":", "<", '"', "/", ">"],
      provideCompletionItems: async (m, position) => {
        if (m !== model) return { suggestions: [] };
        let result;
        try {
          result = await request("textDocument/completion", {
            textDocument: { uri },
            position: toLspPosition(position),
          });
        } catch {
          return { suggestions: [] };
        }
        const items = Array.isArray(result) ? result : result?.items || [];
        const word = m.getWordUntilPosition(position);
        const range = new monacoNS.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind: monacoNS.languages.CompletionItemKind[LSP_COMPLETION_KIND[item.kind] || "Text"],
            insertText: item.insertText || item.label,
            detail: item.detail,
            documentation: item.documentation?.value || item.documentation,
            range,
          })),
        };
      },
    })
  );

  disposables.push(
    monacoNS.languages.registerHoverProvider(languageId, {
      provideHover: async (m, position) => {
        if (m !== model) return null;
        let result;
        try {
          result = await request("textDocument/hover", {
            textDocument: { uri },
            position: toLspPosition(position),
          });
        } catch {
          return null;
        }
        if (!result?.contents) return null;
        return {
          contents: hoverContentsToStrings(result.contents).map((value) => ({ value })),
          range: result.range ? toMonacoRange(monacoNS, result.range) : undefined,
        };
      },
    })
  );

  return {
    dispose() {
      disposed = true;
      monacoNS.editor.setModelMarkers(model, "lsp", []);
      disposables.forEach((d) => d.dispose());
      if (ws.readyState === WebSocket.OPEN) {
        try {
          send({ jsonrpc: "2.0", id: nextId++, method: "shutdown", params: null });
          notify("exit", null);
        } catch {}
      }
      ws.close();
    },
  };
}
