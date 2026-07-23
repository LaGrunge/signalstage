import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearSession, copyToClipboard, getUser } from "../lib/api.js";

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("python");
  const [languages, setLanguages] = useState([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();
  const user = getUser();

  async function loadRooms() {
    const { data } = await api.get("/rooms");
    setRooms(data);
  }

  useEffect(() => {
    api.get("/languages").then(({ data }) => setLanguages(data));
    loadRooms().catch(() => setError("Failed to load sessions"));
  }, []);

  async function createRoom(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/rooms", { title, language });
      setTitle("");
      await loadRooms();
    } catch {
      setError("Failed to create session");
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
        <button type="submit">Create session</button>
      </form>
      {error && <div className="error">{error}</div>}

      <ul className="room-list">
        {rooms.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.title}</strong>
              <span className="muted"> · {r.language}</span>
            </div>
            <div className="room-actions">
              <Link to={`/room/${r.id}`}>Open</Link>
              <button className="link" onClick={() => copyLink(r.id)}>
                {copiedId === r.id ? "Copied!" : "Copy link"}
              </button>
              <button className="link danger" onClick={() => deleteRoom(r.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {rooms.length === 0 && <li className="muted">No sessions yet</li>}
      </ul>
    </div>
  );
}
