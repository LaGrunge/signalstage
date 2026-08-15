import { useEffect, useState } from "react";
import { api, getUser } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import TopNav from "../components/TopNav.jsx";

// Admin-only: the API refuses every route behind here for anyone else, so this
// page just reports what it gets rather than pretending to guard anything.
export default function Users() {
  const me = getUser();
  const [users, setUsers] = useState([]);
  const [draft, setDraft] = useState({ name: "", email: "", password: "", isAdmin: false });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function load() {
    return api.get("/users").then(({ data }) => setUsers(data));
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || "Failed to load users"));
  }, []);

  async function createUser(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/users", draft);
      setDraft({ name: "", email: "", password: "", isAdmin: false });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create the account");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAdmin(user) {
    setError("");
    try {
      await api.patch(`/users/${user.id}`, { isAdmin: !user.isAdmin });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update the account");
    }
  }

  async function deleteUser(user) {
    const owned = user.sessionCount
      ? `\n\nThis also deletes ${user.sessionCount} session(s) they created, with their playback.`
      : "";
    if (!window.confirm(`Delete ${user.name} <${user.email}>?${owned}`)) return;
    setError("");
    try {
      await api.delete(`/users/${user.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete the account");
    }
  }

  return (
    <div className="dashboard">
      <TopNav />
      {error && <div className="error">{error}</div>}

      <h2>Accounts</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Sessions</th>
            <th>Joined</th>
            <th>Admin</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === me?.id && <span className="muted"> (you)</span>}
              </td>
              <td className="muted">{u.email}</td>
              <td>{u.sessionCount}</td>
              <td className="muted">{formatRelativeTime(u.created_at)}</td>
              <td>
                <input type="checkbox" checked={u.isAdmin} onChange={() => toggleAdmin(u)} />
              </td>
              <td>
                {u.id !== me?.id && (
                  <button className="link danger" onClick={() => deleteUser(u)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add an account</h2>
      <form className="new-room" onSubmit={createUser}>
        <input
          placeholder="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={draft.password}
          onChange={(e) => setDraft({ ...draft, password: e.target.value })}
          required
        />
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={draft.isAdmin}
            onChange={(e) => setDraft({ ...draft, isAdmin: e.target.checked })}
          />{" "}
          Admin
        </label>
        <button type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
