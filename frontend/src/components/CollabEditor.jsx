import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";

const MONACO_LANGUAGE = {
  cpp: "cpp",
  python: "python",
  go: "go",
  java: "java",
};

// ydoc/provider are owned by the parent (Room) so language changes don't tear
// down the collaborative session - only the editor <-> Yjs binding is local.
export default function CollabEditor({ ydoc, provider, language, userName }) {
  const bindingRef = useRef(null);

  function handleMount(editor, monaco) {
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
  }

  useEffect(() => () => bindingRef.current?.destroy(), []);

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

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
