import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import Ansi from "ansi-to-react";
import CollabEditor from "../components/CollabEditor.jsx";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";
import { api, collabUrl, getUser } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { highlightCode } from "../lib/highlight.js";

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
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [leftPanel, setLeftPanel] = useState(null); // null | "templates" | "versions"
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [runEnabled, setRunEnabled] = useState(true);

  // Templates/versions/the run-permission toggle are the interviewer's own
  // tools - a candidate who joined via the link without logging in just
  // won't see any of these controls.
  const isInterviewer = Boolean(getUser());
  const runAllowedForMe = isInterviewer || runEnabled;
  const runningOthers = participants.filter((p) => p.running && p.name !== userName);

  function refreshTemplates() {
    return api
      .get("/templates")
      .then(({ data }) => setTemplates(data))
      .catch(() => {});
  }

  function refreshSubmissions() {
    return api
      .get(`/rooms/${roomId}/submissions`)
      .then(({ data }) => setSubmissions(data))
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
      setRunEnabled(config.get("runEnabled") ?? true);
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
          .map(([clientId, state]) => ({ clientId, ...state.user, running: Boolean(state.running) }))
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

  function toggleRunEnabled() {
    ydoc.getMap("config").set("runEnabled", !runEnabled);
  }

  function insertTemplate(template) {
    if (!window.confirm(`Replace the current code with "${template.title}"?`)) return;
    const ytext = ydoc.getText("code");
    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, template.code);
    });
    if (template.language !== language) changeLanguage(template.language);
    setLeftPanel(null);
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

  function openPanel(panel) {
    if (leftPanel === panel) {
      setLeftPanel(null);
      return;
    }
    setLeftPanel(panel);
    if (panel === "versions") refreshSubmissions();
  }

  async function runCode() {
    setRunning(true);
    setOutput(null);
    provider?.setAwarenessField("running", true);
    try {
      const code = ydoc.getText("code").toString();
      const { data } = await api.post("/execute", { roomId, language, code, stdin, submittedBy: userName });
      setOutput(data);
      if (leftPanel === "versions") refreshSubmissions();
    } catch (err) {
      setOutput({ error: err.response?.data?.error || "Failed to run code" });
    } finally {
      setRunning(false);
      provider?.setAwarenessField("running", false);
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
            <span
              key={p.clientId}
              className={`participant-badge ${p.running ? "running" : ""}`}
              style={{ backgroundColor: p.color }}
              title={p.running ? `${p.name} is running code…` : p.name}
            >
              {initials(p.name)}
            </span>
          ))}
        </div>
        {runningOthers.length > 0 && (
          <span className="muted running-banner">
            {runningOthers.map((p) => p.name).join(", ")} running code…
          </span>
        )}
        {isInterviewer && (
          <button className="link" onClick={toggleRunEnabled}>
            {runEnabled ? "Disable candidate run" : "Enable candidate run"}
          </button>
        )}
        <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <button onClick={runCode} disabled={running || !runAllowedForMe} title={!runAllowedForMe ? "Run disabled by interviewer" : ""}>
          {running ? "Running…" : "▶ Run"}
        </button>
      </header>

      <div className="room-body">
        {isInterviewer && (
          <div className="side-icons">
            <button
              className={`icon-btn ${leftPanel === "templates" ? "active" : ""}`}
              onClick={() => openPanel("templates")}
              title="Insert template"
            >
              🧩
            </button>
            <button
              className={`icon-btn ${leftPanel === "versions" ? "active" : ""}`}
              onClick={() => openPanel("versions")}
              title="Code versions"
            >
              🕘
            </button>
          </div>
        )}

        {leftPanel && (
          <div className="side-panel">
            <div className="side-panel-header">
              <strong>{leftPanel === "templates" ? "Insert template" : "Code versions"}</strong>
              {leftPanel === "templates" && (
                <button className="link" onClick={saveAsTemplate} disabled={savingTemplate}>
                  {savingTemplate ? "Saving…" : "Save current as template"}
                </button>
              )}
              <button className="link" onClick={() => setLeftPanel(null)}>
                Close
              </button>
            </div>
            <div className="side-panel-body">
              {leftPanel === "templates" && (
                <CardGrid>
                  {templates.map((t) => (
                    <PreviewCard
                      key={t.id}
                      title={t.title}
                      language={t.language}
                      preview={t.code}
                      footer={`refreshed ${formatRelativeTime(t.updated_at)}`}
                      onClick={() => insertTemplate(t)}
                    />
                  ))}
                  {templates.length === 0 && <div className="muted">No templates yet</div>}
                </CardGrid>
              )}
              {leftPanel === "versions" && (
                <CardGrid>
                  {submissions.map((s) => (
                    <PreviewCard
                      key={s.id}
                      title={s.status || "Unknown"}
                      language={s.language}
                      preview={s.code}
                      footer={`${s.submitted_by} · ${formatRelativeTime(s.created_at)}`}
                      onClick={() => setViewingSubmission(s)}
                    />
                  ))}
                  {submissions.length === 0 && <div className="muted">No runs yet</div>}
                </CardGrid>
              )}
            </div>
          </div>
        )}

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

      {viewingSubmission && (
        <div className="modal-overlay" onClick={() => setViewingSubmission(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>
                {viewingSubmission.language} · {viewingSubmission.status} ·{" "}
                {formatRelativeTime(viewingSubmission.created_at)}
              </strong>
              <button className="link" onClick={() => setViewingSubmission(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-code">
                <label>Code</label>
                <pre>
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={highlightCode(viewingSubmission.code, viewingSubmission.language)}
                  />
                </pre>
              </div>
              <div className="modal-output">
                <label>Result</label>
                {viewingSubmission.compile_output && (
                  <pre className="compile">
                    <Ansi>{viewingSubmission.compile_output}</Ansi>
                  </pre>
                )}
                {viewingSubmission.stdout && (
                  <pre>
                    <Ansi>{viewingSubmission.stdout}</Ansi>
                  </pre>
                )}
                {viewingSubmission.stderr && (
                  <pre className="stderr">
                    <Ansi>{viewingSubmission.stderr}</Ansi>
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}
