import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearSession, getUser } from "../lib/api.js";

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("python");
  const [languages, setLanguages] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = getUser();

  async function loadRooms() {
    const { data } = await api.get("/rooms");
    setRooms(data);
  }

  useEffect(() => {
    api.get("/languages").then(({ data }) => setLanguages(data));
    loadRooms().catch(() => setError("Не удалось загрузить сессии"));
  }, []);

  async function createRoom(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/rooms", { title, language });
      setTitle("");
      await loadRooms();
    } catch {
      setError("Не удалось создать сессию");
    }
  }

  async function deleteRoom(id) {
    await api.delete(`/rooms/${id}`);
    await loadRooms();
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="dashboard">
      <header>
        <h1>SignalStage</h1>
        <div>
          <span className="muted">{user?.name}</span>
          <button className="link" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <form className="new-room" onSubmit={createRoom}>
        <input
          placeholder="Название интервью (например, Иван И. — Backend)"
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
        <button type="submit">Создать сессию</button>
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
              <Link to={`/room/${r.id}`}>Открыть</Link>
              <button
                className="link"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/room/${r.id}`);
                }}
              >
                Скопировать ссылку
              </button>
              <button className="link danger" onClick={() => deleteRoom(r.id)}>
                Удалить
              </button>
            </div>
          </li>
        ))}
        {rooms.length === 0 && <li className="muted">Пока нет сессий</li>}
      </ul>
    </div>
  );
}
