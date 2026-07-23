import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import Ansi from "ansi-to-react";
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
  const [templates, setTemplates] = useState([]);
  const [templateToInsert, setTemplateToInsert] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Templates are the interviewer's private library - a candidate who joined
  // via the link without logging in just won't see template controls at all.
  const isInterviewer = Boolean(getUser());

  function refreshTemplates() {
    return api
      .get("/templates")
      .then(({ data }) => setTemplates(data))
      .catch(() => {});
  }

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
    if (loggedInUser) refreshTemplates();
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

  function insertTemplate() {
    const template = templates.find((t) => t.id === templateToInsert);
    if (!template) return;
    if (!window.confirm(`Replace the current code with "${template.title}"?`)) return;
    const ytext = ydoc.getText("code");
    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, template.code);
    });
    if (template.language !== language) changeLanguage(template.language);
  }

  async function saveAsTemplate() {
    const title = window.prompt("Template title:");
    if (!title?.trim()) return;
    setSavingTemplate(true);
    try {
      const code = ydoc.getText("code").toString();
      await api.post("/templates", { title: title.trim(), language, code });
      await refreshTemplates();
    } catch {
      window.alert("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
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
        {isInterviewer && (
          <>
            <select value={templateToInsert} onChange={(e) => setTemplateToInsert(e.target.value)}>
              <option value="">{templates.length ? "Insert template…" : "No templates yet"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.language})
                </option>
              ))}
            </select>
            <button className="link" onClick={insertTemplate} disabled={!templateToInsert}>
              Insert
            </button>
            <button className="link" onClick={saveAsTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Saving…" : "Save as template"}
            </button>
          </>
        )}
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
            {output?.error && (
              <pre className="error">
                <Ansi>{output.error}</Ansi>
              </pre>
            )}
            {output && !output.error && (
              <>
                <div className="muted">
                  {output.status?.description} · {output.time ?? "?"}s · {output.memory ?? "?"}KB
                </div>
                {output.compileOutput && (
                  <pre className="compile">
                    <Ansi>{output.compileOutput}</Ansi>
                  </pre>
                )}
                {output.stdout && (
                  <pre>
                    <Ansi>{output.stdout}</Ansi>
                  </pre>
                )}
                {output.stderr && (
                  <pre className="stderr">
                    <Ansi>{output.stderr}</Ansi>
                  </pre>
                )}
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
