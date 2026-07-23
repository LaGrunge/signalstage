import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import Ansi from "ansi-to-react";
import CollabEditor from "../components/CollabEditor.jsx";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";
import { api, collabUrl, getUser } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { highlightCode } from "../lib/highlight.js";

const FILE_EXTENSIONS = { cpp: "cpp", python: "py", go: "go", java: "java", bash: "sh", mariadb: "sql" };

export default function Room() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
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
  const [leftPanel, setLeftPanel] = useState(null); // null | "templates" | "versions" | "problems"
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [runEnabled, setRunEnabled] = useState(true);
  const [savedAt, setSavedAt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [problems, setProblems] = useState([]);
  const [testsEnabled, setTestsEnabled] = useState(true);
  const [testResults, setTestResults] = useState(null);
  const [testsRunning, setTestsRunning] = useState(false);
  const [taskOpen, setTaskOpen] = useState(true);

  // Templates/versions/the run-permission toggle are the interviewer's own
  // tools - gated on actually owning *this* room (created_by), not just on
  // being logged into some account, so a candidate link forwarded to another
  // interviewer's account doesn't render as if they created it.
  const currentUser = getUser();
  const isInterviewer = Boolean(currentUser) && room?.createdBy === currentUser.id;
  const runAllowedForMe = isInterviewer || runEnabled;
  const testsAllowedForMe = isInterviewer || testsEnabled;
  const runningOthers = participants.filter((p) => p.running && p.name !== userName);
  const personalTemplates = templates.filter((t) => t.mine && !t.shared);
  const sharedTemplates = templates.filter((t) => t.shared);

  function refreshTemplates() {
    return api
      .get("/templates")
      .then(({ data }) => setTemplates(data))
      .catch(() => {});
  }

  function refreshProblems() {
    return api
      .get("/problems")
      .then(({ data }) => setProblems(data))
      .catch(() => {});
  }

  function refreshRoomProblem() {
    return api
      .get(`/rooms/${roomId}/problem`)
      .then(({ data }) => setProblem(data))
      .catch(() => setProblem(null));
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
        setRunEnabled(data.runEnabled ?? true);
        setTestsEnabled(data.testsEnabled ?? true);
        const loggedInUser = getUser();
        if (loggedInUser && loggedInUser.id === data.createdBy) {
          refreshTemplates();
          refreshProblems();
        }
        if (data.problemId) refreshRoomProblem();
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
      setRunEnabled(config.get("runEnabled") ?? true);
      setTestsEnabled(config.get("testsEnabled") ?? true);
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

  function saveCode() {
    const code = ydoc.getText("code").toString();
    const ext = FILE_EXTENSIONS[language] || "txt";
    const filename = `${(room?.title || "code").replace(/[^a-z0-9-_]+/gi, "_")}.${ext}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSavedAt(true);
    setTimeout(() => setSavedAt(false), 2000);
  }

  // Ctrl/Cmd+S normally triggers the browser's "Save page" dialog - intercept
  // it globally and download the current code as a file instead.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveCode();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [roomId, ydoc]);

  function changeLanguage(lang) {
    ydoc.getMap("config").set("language", lang);
    setLanguage(lang);
  }

  async function toggleRunEnabled() {
    try {
      const { data } = await api.patch(`/rooms/${roomId}`, { runEnabled: !runEnabled });
      ydoc.getMap("config").set("runEnabled", data.runEnabled);
    } catch {
      window.alert("Failed to update run permission");
    }
  }

  async function toggleTestsEnabled() {
    try {
      const { data } = await api.patch(`/rooms/${roomId}`, { testsEnabled: !testsEnabled });
      ydoc.getMap("config").set("testsEnabled", data.testsEnabled);
    } catch {
      window.alert("Failed to update test permission");
    }
  }

  // Mirrors insertTemplate: attaching a problem seeds the live editor from
  // that problem's starter for the room's current language (if it has one)
  // - the server only records which problem is attached, it doesn't touch
  // the live Yjs document itself.
  async function attachProblem(summary) {
    if (!window.confirm(`Attach "${summary.title}" as this room's task? This replaces the current code.`)) return;
    try {
      const { data: full } = await api.get(`/problems/${summary.id}`);
      const { data: updatedRoom } = await api.patch(`/rooms/${roomId}`, { problemId: full.id });
      setRoom((r) => ({ ...r, problemId: updatedRoom.problemId }));
      setProblem({
        id: full.id,
        title: full.title,
        description: full.description,
        signatureHint: full.signatureHint,
        testCode: full.testCode.map((t) => ({ language: t.language, publicCode: t.publicCode })),
      });
      setTestResults(null);
      const starter = full.starters.find((s) => s.language === language);
      if (starter) {
        const ytext = ydoc.getText("code");
        ydoc.transact(() => {
          ytext.delete(0, ytext.length);
          ytext.insert(0, starter.code);
        });
      }
      setLeftPanel(null);
    } catch {
      window.alert("Failed to attach problem");
    }
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
    const shared = window.confirm("Share this template with all interviewers? Cancel keeps it personal.");
    setSavingTemplate(true);
    try {
      const code = ydoc.getText("code").toString();
      await api.post("/templates", { title: title.trim(), language, code, shared });
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

  // mode: "run" (public example cases only, fast feedback) vs "submit"
  // (every case including hidden ones, graded and recorded).
  async function runTestsAction(mode) {
    setTestsRunning(true);
    setTestResults(null);
    provider?.setAwarenessField("running", true);
    try {
      const code = ydoc.getText("code").toString();
      const { data } = await api.post(`/rooms/${roomId}/tests`, { code, mode, submittedBy: userName });
      setTestResults(data);
    } catch (err) {
      setTestResults({ error: err.response?.data?.error || "Failed to run tests" });
    } finally {
      setTestsRunning(false);
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
        <img
          className="logo room-logo"
          src="/SignalStageNoTitle.png"
          alt="SignalStage"
          onClick={isInterviewer ? () => navigate("/dashboard") : undefined}
          style={{ cursor: isInterviewer ? "pointer" : "default" }}
        />
        <div>
          <strong>{room.title}</strong>
          <span className={`status ${connected ? "online" : "offline"}`}>
            {connected ? "connected" : "connecting…"}
          </span>
        </div>
        <span className={`you-badge ${isInterviewer ? "interviewer" : "candidate"}`}>
          {userName} · {isInterviewer ? "Interviewer" : "Candidate"}
        </span>
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
        {isInterviewer && !room.problemId && (
          <button className="link" onClick={toggleRunEnabled}>
            {runEnabled ? "Disable candidate run" : "Enable candidate run"}
          </button>
        )}
        {isInterviewer && room.problemId && (
          <button className="link" onClick={toggleTestsEnabled}>
            {testsEnabled ? "Disable candidate tests" : "Enable candidate tests"}
          </button>
        )}
        <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <button onClick={saveCode} title="Download code as a file (Ctrl+S)">
          {savedAt ? "Saved" : "💾 Save"}
        </button>
        {room.problemId ? (
          <>
            <button
              onClick={() => runTestsAction("run")}
              disabled={testsRunning || !testsAllowedForMe}
              title={!testsAllowedForMe ? "Tests disabled by interviewer" : "Run the public example cases"}
            >
              {testsRunning ? "Running…" : "▶ Run tests"}
            </button>
            <button
              onClick={() => runTestsAction("submit")}
              disabled={testsRunning || !testsAllowedForMe}
              title={!testsAllowedForMe ? "Tests disabled by interviewer" : "Run every test case, including hidden ones"}
            >
              {testsRunning ? "Running…" : "Submit"}
            </button>
          </>
        ) : (
          <button onClick={runCode} disabled={running || !runAllowedForMe} title={!runAllowedForMe ? "Run disabled by interviewer" : ""}>
            {running ? "Running…" : "▶ Run"}
          </button>
        )}
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
            <button
              className={`icon-btn ${leftPanel === "problems" ? "active" : ""}`}
              onClick={() => openPanel("problems")}
              title="Attach a problem"
            >
              🧪
            </button>
          </div>
        )}

        {leftPanel && (
          <div className="side-panel">
            <div className="side-panel-header">
              <strong>
                {leftPanel === "templates" && "Insert template"}
                {leftPanel === "versions" && "Code versions"}
                {leftPanel === "problems" && "Attach a problem"}
              </strong>
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
                <>
                  <h3 className="side-panel-subheading">Personal</h3>
                  <CardGrid>
                    {personalTemplates.map((t) => (
                      <PreviewCard
                        key={t.id}
                        title={t.title}
                        language={t.language}
                        preview={t.code}
                        footer={`refreshed ${formatRelativeTime(t.updated_at)}`}
                        onClick={() => insertTemplate(t)}
                      />
                    ))}
                    {personalTemplates.length === 0 && <div className="muted">No personal templates yet</div>}
                  </CardGrid>
                  <h3 className="side-panel-subheading">Shared</h3>
                  <CardGrid>
                    {sharedTemplates.map((t) => (
                      <PreviewCard
                        key={t.id}
                        title={t.title}
                        language={t.language}
                        preview={t.code}
                        footer={`refreshed ${formatRelativeTime(t.updated_at)}`}
                        onClick={() => insertTemplate(t)}
                      />
                    ))}
                    {sharedTemplates.length === 0 && <div className="muted">No shared templates yet</div>}
                  </CardGrid>
                </>
              )}
              {leftPanel === "problems" && (
                <CardGrid>
                  {problems.map((p) => (
                    <PreviewCard
                      key={p.id}
                      title={p.title}
                      preview={p.description}
                      footer={`${"★".repeat(p.difficulty)}${"☆".repeat(5 - p.difficulty)} · refreshed ${formatRelativeTime(p.updated_at)}`}
                      onClick={() => attachProblem(p)}
                    />
                  ))}
                  {problems.length === 0 && (
                    <div className="muted">
                      No problems yet - create one from the dashboard's Problem Bank.
                    </div>
                  )}
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
          {problem && (
            <div className="task-panel">
              <div className="task-panel-header" onClick={() => setTaskOpen((o) => !o)}>
                <strong>📋 {problem.title}</strong>
                <span className="link">{taskOpen ? "Hide" : "Show"}</span>
              </div>
              {taskOpen && (
                <div className="task-panel-body">
                  <p className="task-description">{problem.description}</p>
                  {problem.signatureHint && (
                    <p className="muted">
                      Signature: <code>{problem.signatureHint}</code>
                    </p>
                  )}
                  {(() => {
                    const publicCode = problem.testCode?.find((t) => t.language === language)?.publicCode;
                    if (!publicCode?.trim()) return null;
                    return (
                      <>
                        <h4 className="side-panel-subheading">Example tests ({language})</h4>
                        <pre className="task-example">
                          <code className="hljs" dangerouslySetInnerHTML={highlightCode(publicCode, language)} />
                        </pre>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          <div className="editor-pane-editor">
            <CollabEditor ydoc={ydoc} provider={provider} language={language} userName={userName} />
          </div>
        </div>
        <div className="io-pane">
          {room.problemId ? (
            <div className="io-block output">
              <label>Test results</label>
              {testResults?.error && (
                <pre className="error">
                  <Ansi>{testResults.error}</Ansi>
                </pre>
              )}
              {testResults && !testResults.error && (
                <>
                  <div className="muted">
                    {testResults.mode === "run" ? "Run (examples only)" : "Submit (all cases)"} ·{" "}
                    {testResults.passedCount}/{testResults.totalCount} passed
                  </div>
                  {testResults.compileOutput && (
                    <pre className="compile">
                      <Ansi>{testResults.compileOutput}</Ansi>
                    </pre>
                  )}
                  <div className="test-case-list">
                    {testResults.results.map((r, i) => (
                      <div key={i} className={`test-case ${r.passed ? "passed" : "failed"}`}>
                        <div className="test-case-title">
                          {r.passed ? "✅" : "❌"} {r.name}
                          {r.isHidden ? " (hidden)" : ""}
                        </div>
                        {r.message && <div className="test-case-error">{r.message}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!testResults && <div className="muted">Click "Run tests" or "Submit" to see results</div>}
            </div>
          ) : (
            <>
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
            </>
          )}
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
