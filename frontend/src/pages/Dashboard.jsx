import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, copyToClipboard, getUser } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("python");
  const [languages, setLanguages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);
  const [creatingFromProblem, setCreatingFromProblem] = useState(null);
  const navigate = useNavigate();
  const user = getUser();
  const personalTemplates = templates.filter((t) => t.mine && !t.shared);
  const sharedTemplates = templates.filter((t) => t.shared);

  async function loadRooms() {
    const { data } = await api.get("/rooms");
    setRooms(data);
  }

  async function loadTemplates() {
    const { data } = await api.get("/templates");
    setTemplates(data);
  }

  async function loadProblems() {
    const { data } = await api.get("/problems");
    setProblems(data);
  }

  useEffect(() => {
    api.get("/languages").then(({ data }) => setLanguages(data));
    loadRooms().catch(() => setError("Failed to load sessions"));
    loadTemplates().catch(() => setError("Failed to load templates"));
    loadProblems().catch(() => setError("Failed to load problems"));
  }, []);

  async function createRoom(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/rooms", { title, language });
      setTitle("");
      await loadRooms();
      navigate(`/room/${data.id}`);
    } catch {
      setError("Failed to create session");
    }
  }

  async function createFromTemplate(template) {
    setError("");
    setCreatingFromTemplate(template.id);
    try {
      const { data } = await api.post("/rooms", { templateId: template.id });
      navigate(`/room/${data.id}`);
    } catch {
      setError("Failed to create session from template");
      setCreatingFromTemplate(null);
    }
  }

  async function createFromProblem(problem) {
    setError("");
    setCreatingFromProblem(problem.id);
    try {
      const { data } = await api.post("/rooms", { language, problemId: problem.id });
      navigate(`/room/${data.id}`);
    } catch {
      setError("Failed to create session from problem");
      setCreatingFromProblem(null);
    }
  }

  async function deleteRoom(id) {
    try {
      await api.delete(`/rooms/${id}`);
      await loadRooms();
    } catch {
      setError("Failed to delete session");
    }
  }

  async function deleteTemplate(id) {
    try {
      await api.delete(`/templates/${id}`);
      await loadTemplates();
    } catch {
      setError("Failed to delete template");
    }
  }

  async function renameRoom(id, title) {
    try {
      await api.patch(`/rooms/${id}`, { title });
      await loadRooms();
    } catch {
      setError("Failed to rename session");
    }
  }

  async function renameTemplate(id, title) {
    try {
      await api.patch(`/templates/${id}`, { title });
      await loadTemplates();
    } catch {
      setError("Failed to rename template");
    }
  }

  async function toggleTemplateShared(template) {
    try {
      await api.patch(`/templates/${template.id}`, { shared: !template.shared });
      await loadTemplates();
    } catch {
      setError("Failed to update template");
    }
  }

  async function copyLink(id) {
    try {
      await copyToClipboard(`${window.location.origin}/room/${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setError("Failed to copy link");
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <header>
        <img className="logo" src="/signalstage-logo.png" alt="SignalStage" />
        <div>
          <button className="link" onClick={() => navigate("/problems")}>
            Problem bank
          </button>
          <span className="muted">{user?.name}</span>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <form className="new-room" onSubmit={createRoom}>
        <input
          placeholder="Interview title (e.g. Jane D. — Backend)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {languages.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <button type="submit">Create blank session</button>
      </form>
      {error && <div className="error">{error}</div>}

      <h2>Sessions</h2>
      <CardGrid>
        {rooms.map((r) => (
          <PreviewCard
            key={r.id}
            title={r.title}
            language={r.language}
            preview={r.preview}
            footer={`refreshed ${formatRelativeTime(r.last_active_at)}`}
            participantCount={r.participantCount}
            onClick={() => navigate(`/room/${r.id}`)}
            onRename={(newTitle) => renameRoom(r.id, newTitle)}
            actions={[
              { key: "copy", label: copiedId === r.id ? "Copied!" : "Copy link", onClick: () => copyLink(r.id) },
              { key: "delete", label: "Delete", danger: true, onClick: () => deleteRoom(r.id) },
            ]}
          />
        ))}
        {rooms.length === 0 && <div className="muted">No sessions yet</div>}
      </CardGrid>

      <h2>Personal templates</h2>
      <p className="muted">
        Save one from inside a session ("Save as template"). Click a card to start a new session from it.
      </p>
      <CardGrid>
        {personalTemplates.map((t) => (
          <PreviewCard
            key={t.id}
            title={t.title}
            language={t.language}
            preview={t.code}
            footer={creatingFromTemplate === t.id ? "Creating session…" : `refreshed ${formatRelativeTime(t.updated_at)}`}
            onClick={() => createFromTemplate(t)}
            onRename={(newTitle) => renameTemplate(t.id, newTitle)}
            actions={[
              { key: "share", label: "Share with all interviewers", onClick: () => toggleTemplateShared(t) },
              { key: "delete", label: "Delete", danger: true, onClick: () => deleteTemplate(t.id) },
            ]}
          />
        ))}
        {personalTemplates.length === 0 && <div className="muted">No personal templates yet</div>}
      </CardGrid>

      <h2>Shared templates</h2>
      <p className="muted">The common task bank - visible to every interviewer.</p>
      <CardGrid>
        {sharedTemplates.map((t) => (
          <PreviewCard
            key={t.id}
            title={t.title}
            language={t.language}
            preview={t.code}
            footer={creatingFromTemplate === t.id ? "Creating session…" : `refreshed ${formatRelativeTime(t.updated_at)}`}
            onClick={() => createFromTemplate(t)}
            onRename={t.mine ? (newTitle) => renameTemplate(t.id, newTitle) : undefined}
            actions={
              t.mine
                ? [
                    { key: "unshare", label: "Make personal", onClick: () => toggleTemplateShared(t) },
                    { key: "delete", label: "Delete", danger: true, onClick: () => deleteTemplate(t.id) },
                  ]
                : []
            }
          />
        ))}
        {sharedTemplates.length === 0 && <div className="muted">No shared templates yet</div>}
      </CardGrid>

      <h2>Problems</h2>
      <p className="muted">
        Structured tasks with automated tests - manage the full set (description, starter code, reference
        solutions, tests) in the <button className="link" onClick={() => navigate("/problems")}>Problem bank</button>.
        Click a card to start a new session from it.
      </p>
      <CardGrid>
        {problems.map((p) => (
          <PreviewCard
            key={p.id}
            title={p.title}
            preview={p.description}
            footer={
              creatingFromProblem === p.id
                ? "Creating session…"
                : `${p.functionName} · ${p.shared ? "shared" : "personal"} · refreshed ${formatRelativeTime(p.updated_at)}`
            }
            onClick={() => createFromProblem(p)}
          />
        ))}
        {problems.length === 0 && <div className="muted">No problems yet</div>}
      </CardGrid>
    </div>
  );
}
