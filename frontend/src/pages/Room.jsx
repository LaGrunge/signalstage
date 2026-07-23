import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import CollabEditor from "../components/CollabEditor.jsx";
import { api, collabUrl, getUser } from "../lib/api.js";

export default function Room() {
  const { id: roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [userName, setUserName] = useState(() => sessionStorage.getItem("displayName") || "");
  const [nameInput, setNameInput] = useState("");
  const [language, setLanguage] = useState("python");
  const [languages, setLanguages] = useState([]);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    api
      .get(`/rooms/${roomId}`)
      .then(({ data }) => {
        setRoom(data);
        setLanguage(data.language);
      })
      .catch(() => setNotFound(true));
    api.get("/languages").then(({ data }) => setLanguages(data));

    const loggedInUser = getUser();
    if (loggedInUser && !sessionStorage.getItem("displayName")) {
      setUserName(loggedInUser.name);
      sessionStorage.setItem("displayName", loggedInUser.name);
    }
  }, [roomId]);

  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const provider = useMemo(() => {
    if (!userName) return null;
    return new HocuspocusProvider({
      url: collabUrl(),
      name: roomId,
      document: ydoc,
      token: userName,
      onStatus: ({ status }) => setConnected(status === "connected"),
    });
  }, [roomId, userName, ydoc]);

  useEffect(() => {
    if (!provider) return;
    const config = ydoc.getMap("config");
    const onUpdate = () => {
      const lang = config.get("language");
      if (lang) setLanguage(lang);
    };
    config.observe(onUpdate);
    onUpdate();
    return () => config.unobserve(onUpdate);
  }, [provider, ydoc]);

  useEffect(() => {
    if (!provider) return;
    const { awareness } = provider;
    const updateParticipants = () => {
      const entries = Array.from(awareness.getStates().entries());
      setParticipants(
        entries
          .filter(([, state]) => state.user)
          .map(([clientId, state]) => ({ clientId, ...state.user }))
      );
    };
    awareness.on("change", updateParticipants);
    updateParticipants();
    return () => awareness.off("change", updateParticipants);
  }, [provider]);

  useEffect(() => () => provider?.destroy(), [provider]);

  function changeLanguage(lang) {
    ydoc.getMap("config").set("language", lang);
    setLanguage(lang);
  }

  async function runCode() {
    setRunning(true);
    setOutput(null);
    try {
      const code = ydoc.getText("code").toString();
      const { data } = await api.post("/execute", { roomId, language, code, stdin });
      setOutput(data);
    } catch (err) {
      setOutput({ error: err.response?.data?.error || "Failed to run code" });
    } finally {
      setRunning(false);
    }
  }

  if (notFound) return <div className="center-message">Session not found or closed.</div>;
  if (!room) return <div className="center-message">Loading…</div>;

  if (!userName) {
    return (
      <div className="auth-page">
        <form
          className="auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem("displayName", nameInput.trim());
            setUserName(nameInput.trim());
          }}
        >
          <h1>{room.title}</h1>
          <p className="subtitle">What should we call you?</p>
          <input placeholder="Your name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
          <button type="submit">Join session</button>
        </form>
      </div>
    );
  }

  return (
    <div className="room">
      <header className="room-header">
        <div>
          <strong>{room.title}</strong>
          <span className={`status ${connected ? "online" : "offline"}`}>
            {connected ? "connected" : "connecting…"}
          </span>
        </div>
        <div className="participants" title={participants.map((p) => p.name).join(", ")}>
          {participants.map((p) => (
            <span key={p.clientId} className="participant-badge" style={{ backgroundColor: p.color }}>
              {initials(p.name)}
            </span>
          ))}
        </div>
        <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <button onClick={runCode} disabled={running}>
          {running ? "Running…" : "▶ Run"}
        </button>
      </header>

      <div className="room-body">
        <div className="editor-pane">
          <CollabEditor ydoc={ydoc} provider={provider} language={language} userName={userName} />
        </div>
        <div className="io-pane">
          <div className="io-block">
            <label>stdin</label>
            <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={6} />
          </div>
          <div className="io-block output">
            <label>Output</label>
            {output?.error && <pre className="error">{output.error}</pre>}
            {output && !output.error && (
              <>
                <div className="muted">
                  {output.status?.description} · {output.time ?? "?"}s · {output.memory ?? "?"}KB
                </div>
                {output.compileOutput && <pre className="compile">{output.compileOutput}</pre>}
                {output.stdout && <pre>{output.stdout}</pre>}
                {output.stderr && <pre className="stderr">{output.stderr}</pre>}
              </>
            )}
            {!output && <div className="muted">Click "Run" to see the output</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}
