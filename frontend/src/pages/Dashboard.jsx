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
      <CardGrid>
        {rooms.map((r) => (
          <PreviewCard
            key={r.id}
            title={r.title}
            subtitle={r.language}
            preview={r.preview}
            footer={`refreshed ${formatRelativeTime(r.last_active_at)}`}
            onClick={() => navigate(`/room/${r.id}`)}
            actions={
              <>
                <button className="link" onClick={(e) => copyLink(r.id, e)}>
                  {copiedId === r.id ? "Copied!" : "Copy link"}
                </button>
                <button className="link danger" onClick={(e) => deleteRoom(r.id, e)}>
                  Delete
                </button>
              </>
            }
          />
        ))}
        {rooms.length === 0 && <div className="muted">No sessions yet</div>}
      </CardGrid>

      <h2>Code templates</h2>
      <p className="muted">
        Save one from inside a session ("Save as template"). Click a card to start a new session from it.
      </p>
      <CardGrid>
        {templates.map((t) => (
          <PreviewCard
            key={t.id}
            title={t.title}
            subtitle={t.language}
            preview={t.code}
            footer={creatingFromTemplate === t.id ? "Creating session…" : `refreshed ${formatRelativeTime(t.updated_at)}`}
            onClick={() => createFromTemplate(t)}
            actions={
              <button className="link danger" onClick={(e) => deleteTemplate(t.id, e)}>
                Delete
              </button>
            }
          />
        ))}
        {templates.length === 0 && <div className="muted">No templates yet</div>}
      </CardGrid>
    </div>
  );
}
