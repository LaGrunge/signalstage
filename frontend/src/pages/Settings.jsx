import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import TopNav from "../components/TopNav.jsx";

// Instance-wide defaults for new sessions. Admin-only, like the accounts tab:
// the API refuses writes from anyone else, so this page reflects rather than
// enforces that.
export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => setSettings(data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load settings"));
  }, []);

  async function update(patch) {
    setError("");
    try {
      const { data } = await api.patch("/settings", patch);
      setSettings(data);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save settings");
    }
  }

  return (
    <div className="dashboard">
      <TopNav />
      {error && <div className="error">{error}</div>}

      <h2>How new sessions start</h2>
      <p className="muted">
        Applies to every session created from now on, for every interviewer. Both switches stay
        changeable inside a running session.
      </p>

      {settings && (
        <div className="settings-list">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={settings.defaultRunEnabled}
              onChange={(e) => update({ defaultRunEnabled: e.target.checked })}
            />{" "}
            Candidates can run code
          </label>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={settings.defaultCopyPasteBlocked}
              onChange={(e) => update({ defaultCopyPasteBlocked: e.target.checked })}
            />{" "}
            Block copy and paste for candidates
          </label>
          {savedAt && <span className="muted">Saved</span>}
        </div>
      )}
    </div>
  );
}
