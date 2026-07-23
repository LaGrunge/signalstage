import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, copyToClipboard, getUser } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("python");
  const [languages, setLanguages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);
  const navigate = useNavigate();
  const user = getUser();

  async function loadRooms() {
    const { data } = await api.get("/rooms");
    setRooms(data);
  }

  async function loadTemplates() {
    const { data } = await api.get("/templates");
    setTemplates(data);
  }

  useEffect(() => {
    api.get("/languages").then(({ data }) => setLanguages(data));
    loadRooms().catch(() => setError("Failed to load sessions"));
    loadTemplates().catch(() => setError("Failed to load templates"));
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

  async function deleteRoom(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/rooms/${id}`);
      await loadRooms();
    } catch {
      setError("Failed to delete session");
    }
  }

  async function deleteTemplate(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/templates/${id}`);
      await loadTemplates();
    } catch {
      setError("Failed to delete template");
    }
  }

  async function copyLink(id, e) {
    e.stopPropagation();
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
      <div className="card-grid">
        {rooms.map((r) => (
          <div key={r.id} className="card" onClick={() => navigate(`/room/${r.id}`)}>
            <div className="card-head">
              <strong>{r.title}</strong>
              <span className="muted">{r.language}</span>
            </div>
            <pre className="card-preview">{r.preview || " "}</pre>
            <div className="card-footer">
              <span className="muted">refreshed {formatRelativeTime(r.last_active_at)}</span>
              <div className="card-actions">
                <button className="link" onClick={(e) => copyLink(r.id, e)}>
                  {copiedId === r.id ? "Copied!" : "Copy link"}
                </button>
                <button className="link danger" onClick={(e) => deleteRoom(r.id, e)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <div className="muted">No sessions yet</div>}
      </div>

      <h2>Code templates</h2>
      <p className="muted">
        Save one from inside a session ("Save as template"). Click a card to start a new session from it.
      </p>
      <div className="card-grid">
        {templates.map((t) => (
          <div key={t.id} className="card" onClick={() => createFromTemplate(t)}>
            <div className="card-head">
              <strong>{t.title}</strong>
              <span className="muted">{t.language}</span>
            </div>
            <pre className="card-preview">{t.code || " "}</pre>
            <div className="card-footer">
              <span className="muted">
                {creatingFromTemplate === t.id ? "Creating session…" : `refreshed ${formatRelativeTime(t.updated_at)}`}
              </span>
              <div className="card-actions">
                <button className="link danger" onClick={(e) => deleteTemplate(t.id, e)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {templates.length === 0 && <div className="muted">No templates yet</div>}
      </div>
    </div>
  );
}
