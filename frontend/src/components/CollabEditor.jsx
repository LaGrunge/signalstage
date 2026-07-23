import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { connectLsp } from "../lib/lspClient.js";
import { lspUrl } from "../lib/api.js";

const MONACO_LANGUAGE = {
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
  const lspRef = useRef(null);
  const [editorReady, setEditorReady] = useState(false);

  function handleMount(editor, monaco) {
    monacoRef.current = monaco;
    modelRef.current = editor.getModel();

    const ytext = ydoc.getText("code");
    bindingRef.current = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );

    provider.setAwarenessField("user", {
      name: userName,
      color: `hsl(${Math.abs(hashCode(userName)) % 360}, 70%, 45%)`,
    });

    setEditorReady(true);
  }

  useEffect(() => () => bindingRef.current?.destroy(), []);

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
        const color = state.user.color;
        const name = escapeCssString(state.user.name || "Anonymous");
        rules.push(`
          .yRemoteSelection-${clientID} { background-color: ${color}55; }
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

// userName is free-text and lands directly in a CSS content: "..." value
// (injected via a <style> tag, not the DOM tree) - escape quotes/backslashes
// so a display name can't break out of the string and inject arbitrary CSS.
function escapeCssString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
