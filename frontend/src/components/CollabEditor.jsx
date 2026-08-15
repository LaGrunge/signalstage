import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { connectLsp } from "../lib/lspClient.js";
import { lspUrl } from "../lib/api.js";

export const MONACO_LANGUAGE = {
  cpp: "cpp",
  python: "python",
  go: "go",
  java: "java",
  bash: "shell",
  mariadb: "sql",
};

// ydoc/provider are owned by the parent (Room) so language changes don't tear
// down the collaborative session - only the editor <-> Yjs binding is local.
export default function CollabEditor({ ydoc, provider, language, userName }) {
  const bindingRef = useRef(null);
  const monacoRef = useRef(null);
  const modelRef = useRef(null);
  const editorRef = useRef(null);
  const lspRef = useRef(null);
  const [editorReady, setEditorReady] = useState(false);

  function handleMount(editor, monaco) {
    monacoRef.current = monaco;
    editorRef.current = editor;
    const model = editor.getModel();
    modelRef.current = model;

    const ytext = ydoc.getText("code");
    // Monaco keeps ONE end-of-line sequence for the whole buffer and rewrites
    // anything written into it to match, while y-monaco maps model offsets
    // 1:1 onto Y.Text indices (it feeds change.rangeOffset straight into
    // ytext.delete/insert). So the moment a model normalises to CRLF while
    // the shared text holds bare LF, every local edit lands one character too
    // far right per line above the cursor - silently, forever, and growing.
    // That is not hypothetical: it wrecked a real interview (a pasted CRLF
    // snippet, then a peer's buffer flipped to CRLF, and "struct Gamer" ->
    // "class Gamer" landed four characters off as "struclasser"). Pin the EOL
    // to LF and keep \r out of the shared text so the two can't drift apart.
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    stripCarriageReturns(ytext);

    bindingRef.current = new MonacoBinding(ytext, model, new Set([editor]), provider.awareness);

    provider.setAwarenessField("user", {
      name: userName,
      color: `hsl(${Math.abs(hashCode(userName)) % 360}, 70%, 45%)`,
    });

    setEditorReady(true);
  }

  useEffect(() => () => bindingRef.current?.destroy(), []);

  // A peer still running pre-fix code (an open tab from before a deploy) can
  // put a \r back into the shared text at any time, which would desync THIS
  // editor. Scrub it out whenever it appears.
  useEffect(() => {
    const ytext = ydoc.getText("code");
    function onChange(event) {
      if (!event.delta.some((op) => typeof op.insert === "string" && op.insert.includes("\r"))) {
        return;
      }
      // Deferred: editing the type from inside its own observer would run
      // inside the transaction currently being delivered.
      setTimeout(() => stripCarriageReturns(ytext), 0);
    }
    ytext.observe(onChange);
    return () => ytext.unobserve(onChange);
  }, [ydoc]);

  // Last line of defence. An offset desync between Monaco's buffer and Y.Text
  // is invisible to the person typing - their own screen stays coherent, and
  // only the other participants watch the document turn to mush - so nobody
  // can be expected to notice and reload. Compare the two directly and
  // rebuild the binding (its constructor resets the model to the Y.Text)
  // rather than trusting that the causes above are the only ones.
  useEffect(() => {
    if (!editorReady) return;
    const ytext = ydoc.getText("code");
    const timer = setInterval(() => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      if (!model || model.isDisposed()) return;
      if (model.getValue() === ytext.toString()) return;

      console.warn("collab: editor buffer diverged from the shared document, resyncing");
      bindingRef.current?.destroy();
      model.setEOL(monacoRef.current.editor.EndOfLineSequence.LF);
      stripCarriageReturns(ytext);
      modelRef.current = model;
      bindingRef.current = new MonacoBinding(ytext, model, new Set([editor]), provider.awareness);
    }, 5000);
    return () => clearInterval(timer);
  }, [editorReady, ydoc, provider]);

  // y-monaco only assigns decoration classNames (yRemoteSelection-<clientId>,
  // yRemoteSelectionHead-<clientId>) - it renders no color or label itself,
  // so without this the remote cursors/selections above are invisible.
  // clientIds (and their colors) change every session, so the rules have to
  // be regenerated from awareness on every change, not written statically.
  useEffect(() => {
    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);

    function render() {
      const rules = [];
      provider.awareness.getStates().forEach((state, clientID) => {
        if (clientID === ydoc.clientID || !state.user) return;
        // color, like name, is attacker-controlled - any peer can set their
        // own awareness state to arbitrary JSON (e.g. via devtools), and it
        // lands directly in a CSS rule below. Our own client only ever sends
        // an hsl(...) string (see setAwarenessField below), but a hostile
        // peer could send `red; } body { display:none } /*` to break out of
        // the rule - reject anything that isn't a plain hex/rgb/hsl color.
        const color = isSafeCssColor(state.user.color) ? state.user.color : "#888888";
        const name = escapeCssString(state.user.name || "Anonymous");
        rules.push(`
          .yRemoteSelection-${clientID} { background-color: color-mix(in srgb, ${color} 33%, transparent); }
          .yRemoteSelectionHead-${clientID} {
            position: relative;
            border-left: 2px solid ${color};
          }
          .yRemoteSelectionHead-${clientID}::after {
            content: "${name}";
            position: absolute;
            top: -1.25em;
            left: -2px;
            padding: 1px 5px;
            border-radius: 3px;
            background: ${color};
            color: #fff;
            font-size: 11px;
            line-height: 1.4;
            white-space: nowrap;
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
            z-index: 20;
          }
        `);
      });
      styleEl.textContent = rules.join("\n");
    }

    provider.awareness.on("change", render);
    render();
    return () => {
      provider.awareness.off("change", render);
      styleEl.remove();
    };
  }, [provider, ydoc]);

  // Real LSP-backed diagnostics/completion/hover (see lib/lspClient.js) - one
  // connection per language, torn down and reopened whenever the room's
  // language changes so stale providers/sockets never pile up. Monaco loads
  // asynchronously, so this effect can run once before handleMount has set
  // monacoRef/modelRef - editorReady forces a re-run once it has.
  useEffect(() => {
    if (!editorReady) return;
    lspRef.current?.dispose();
    lspRef.current = connectLsp({
      url: lspUrl(language),
      languageId: MONACO_LANGUAGE[language] || "plaintext",
      monacoNS: monacoRef.current,
      model: modelRef.current,
    });
    return () => lspRef.current?.dispose();
  }, [language, editorReady]);

  return (
    <Editor
      height="100%"
      language={MONACO_LANGUAGE[language] || "plaintext"}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
      }}
    />
  );
}

// Removes every \r from the shared text, back to front so the earlier indices
// stay valid. Yjs merges concurrent deletes of the same character, so several
// peers scrubbing at once is harmless.
function stripCarriageReturns(ytext) {
  const text = ytext.toString();
  if (!text.includes("\r")) return;
  ytext.doc.transact(() => {
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === "\r") ytext.delete(i, 1);
    }
  });
}

// userName is free-text and lands directly in a CSS content: "..." value
// (injected via a <style> tag, not the DOM tree) - escape quotes/backslashes
// so a display name can't break out of the string and inject arbitrary CSS.
function escapeCssString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

const SAFE_CSS_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$|^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/;
function isSafeCssColor(value) {
  return typeof value === "string" && SAFE_CSS_COLOR_RE.test(value);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
