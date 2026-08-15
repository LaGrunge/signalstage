import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, copyToClipboard, useIsAdmin } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";
import TopNav from "../components/TopNav.jsx";
import { DEFAULT_LANGUAGE, TESTABLE_LANGUAGES, languageLabel } from "../lib/languages.js";

// Same control on the live and archived lists - one switch, both lists.
function ParticipationFilter({ checked, onChange }) {
  return (
    <label className="filter-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{" "}
      Only sessions I took part in
    </label>
  );
}

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [archivedRooms, setArchivedRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [languages, setLanguages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);
  const [creatingFromProblem, setCreatingFromProblem] = useState(null);
  const [activeTab, setActiveTab] = useState("sessions"); // sessions | personal | shared | problems
  // Default view is the sessions this interviewer took part in; unchecking
  // widens it to every interviewer's sessions.
  const [minePlusJoinedOnly, setMinePlusJoinedOnly] = useState(true);
  const navigate = useNavigate();
  // An admin owns everything as far as these controls are concerned - the API
  // already accepts their edits to other people's rooms and templates.
  const isAdmin = useIsAdmin();
  const personalTemplates = templates.filter((t) => t.mine && !t.shared);
  const sharedTemplates = templates.filter((t) => t.shared);

  async function loadRooms(participatedOnly = minePlusJoinedOnly) {
    const { data } = await api.get(`/rooms${participatedOnly ? "" : "?scope=all"}`);
    setRooms(data);
  }

  async function loadArchivedRooms(participatedOnly = minePlusJoinedOnly) {
    const { data } = await api.get(`/rooms?archived=1${participatedOnly ? "" : "&scope=all"}`);
    setArchivedRooms(data);
  }

  // Both lists follow the same "only sessions I took part in" switch, so
  // flipping it on either tab reloads both rather than leaving the other one
  // showing the previous scope.
  function reloadSessions(participatedOnly) {
    setMinePlusJoinedOnly(participatedOnly);
    return Promise.all([loadRooms(participatedOnly), loadArchivedRooms(participatedOnly)]).catch(() =>
      setError("Failed to load sessions")
    );
  }

  async function archiveRoom(id) {
    try {
      await api.post(`/rooms/${id}/archive`, {});
      await Promise.all([loadRooms(), loadArchivedRooms()]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to archive session");
    }
  }

  async function unarchiveRoom(id) {
    try {
      await api.delete(`/rooms/${id}/archive`);
      await Promise.all([loadRooms(), loadArchivedRooms()]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to unarchive session");
    }
  }

  async function loadTemplates() {
    const { data } = await api.get("/templates");
    setTemplates(data);
  }

  // Only what this interviewer liked: the dashboard tab is a shortlist for
  // starting a session fast, deliberately flat and structure-free. Browsing
  // and authoring the whole bank (folders, tests, solutions) is the Problem
  // bank page's job.
  async function loadProblems() {
    const { data } = await api.get("/problems?liked=1");
    setProblems(data);
  }

  useEffect(() => {
    api.get("/languages").then(({ data }) => setLanguages(data));
    loadRooms().catch(() => setError("Failed to load sessions"));
    loadArchivedRooms().catch(() => setError("Failed to load archived sessions"));
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
      const { data } = await api.post("/rooms", { title, templateId: template.id });
      navigate(`/room/${data.id}`);
    } catch {
      setError("Failed to create session from template");
      setCreatingFromTemplate(null);
    }
  }

  // The language matters here in a way it doesn't for a template (which
  // carries its own): it decides which of the problem's per-language starters
  // seeds the editor. A problem that has no starter for the chosen language
  // still opens - to an empty editor - so say so rather than quietly handing
  // the candidate a blank page.
  async function createFromProblem(problem) {
    const available = problem.starterLanguages ?? [];
    if (
      available.length > 0 &&
      !available.includes(language) &&
      !window.confirm(
        `"${problem.title}" has no ${languageLabel(language)} starter ` +
          `(it has ${available.map(languageLabel).join(", ")}).\n\n` +
          `Start the session in ${languageLabel(language)} anyway, with an empty editor?`
      )
    ) {
      return;
    }
    setError("");
    setCreatingFromProblem(problem.id);
    try {
      const { data } = await api.post("/rooms", { title, language, problemId: problem.id });
      navigate(`/room/${data.id}`);
    } catch {
      setError("Failed to create session from problem");
      setCreatingFromProblem(null);
    }
  }

  async function deleteRoom(id) {
    try {
      await api.delete(`/rooms/${id}`);
      await Promise.all([loadRooms(), loadArchivedRooms()]);
    } catch {
      setError("Failed to delete session");
    }
  }

  async function endRoom(id) {
    try {
      await api.post(`/rooms/${id}/end`);
      await loadRooms();
    } catch {
      setError("Failed to end session");
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

  return (
    <div className="dashboard">
      <TopNav />

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
      <p className="muted new-room-hint">
        The title and language above are also used when you start a session from a problem below. A template
        brings its own language with it.
      </p>
      {error && <div className="error">{error}</div>}

      <div className="dashboard-tabs">
        <button className={activeTab === "sessions" ? "active" : ""} onClick={() => setActiveTab("sessions")}>
          Sessions
        </button>
        <button className={activeTab === "personal" ? "active" : ""} onClick={() => setActiveTab("personal")}>
          Personal templates
        </button>
        <button className={activeTab === "shared" ? "active" : ""} onClick={() => setActiveTab("shared")}>
          Shared templates
        </button>
        <button className={activeTab === "archived" ? "active" : ""} onClick={() => setActiveTab("archived")}>
          Archived sessions
        </button>
        <button className={activeTab === "problems" ? "active" : ""} onClick={() => setActiveTab("problems")}>
          Liked problems
        </button>
      </div>

      {activeTab === "sessions" && (
        <>
        <ParticipationFilter checked={minePlusJoinedOnly} onChange={reloadSessions} />
        <CardGrid>
          {rooms.map((r) => (
            <PreviewCard
              key={r.id}
              title={r.title}
              language={r.language}
              preview={r.preview}
              footer={`${
                r.effectivelyEnded
                  ? `ended ${formatRelativeTime(r.ended_at || r.last_active_at)}`
                  : `refreshed ${formatRelativeTime(r.last_active_at)}`
              }${r.mine ? "" : ` · by ${r.ownerName}`}`}
              participantCount={r.participantCount}
              onClick={() => (r.effectivelyEnded ? navigate(`/playback/${r.id}`) : navigate(`/room/${r.id}`))}
              onRename={r.mine || isAdmin ? (newTitle) => renameRoom(r.id, newTitle) : undefined}
              actions={[
                { key: "playback", label: "▶ Playback", onClick: () => navigate(`/playback/${r.id}`) },
                ...(r.effectivelyEnded
                  ? []
                  : [
                      { key: "copy", label: copiedId === r.id ? "Copied!" : "Copy link", onClick: () => copyLink(r.id) },
                      // Ending and deleting stay with the session's owner -
                      // seeing someone else's room is not the same as being
                      // able to close it out from under them.
                      ...(r.mine || isAdmin
                        ? [{ key: "end", label: "End session", onClick: () => endRoom(r.id) }]
                        : []),
                    ]),
                ...(r.effectivelyEnded && (r.mine || isAdmin)
                  ? [{ key: "archive", label: "📦 Archive", onClick: () => archiveRoom(r.id) }]
                  : []),
                ...(r.mine || isAdmin
                  ? [{ key: "delete", label: "Delete", danger: true, onClick: () => deleteRoom(r.id) }]
                  : []),
              ]}
            />
          ))}
          {rooms.length === 0 && (
            <div className="muted">
              {minePlusJoinedOnly ? "No sessions you took part in yet" : "No sessions yet"}
            </div>
          )}
        </CardGrid>
        </>
      )}

      {activeTab === "archived" && (
        <>
          <ParticipationFilter checked={minePlusJoinedOnly} onChange={reloadSessions} />
          <p className="muted">
            Finished sessions filed away. They keep their playback and stay out of the main list; titles are
            fixed once archived, and only an admin can delete one.
          </p>
          <CardGrid>
            {archivedRooms.map((r) => (
              <PreviewCard
                key={r.id}
                title={r.title}
                language={r.language}
                preview={r.preview}
                footer={`archived ${formatRelativeTime(r.archivedAt)}${r.mine ? "" : ` · by ${r.ownerName}`}`}
                onClick={() => navigate(`/playback/${r.id}`)}
                actions={[
                  { key: "playback", label: "▶ Playback", onClick: () => navigate(`/playback/${r.id}`) },
                  ...(r.mine || isAdmin
                    ? [{ key: "unarchive", label: "↩ Unarchive", onClick: () => unarchiveRoom(r.id) }]
                    : []),
                  // Deleting the record of an interview is an admin's call,
                  // not the owner's - see the DELETE handler, which enforces
                  // it independently of this menu.
                  ...(isAdmin
                    ? [{ key: "delete", label: "Delete", danger: true, onClick: () => deleteRoom(r.id) }]
                    : []),
                ]}
              />
            ))}
            {archivedRooms.length === 0 && (
              <div className="muted">
                {minePlusJoinedOnly ? "No archived sessions you took part in" : "No archived sessions"}
              </div>
            )}
          </CardGrid>
        </>
      )}

      {activeTab === "personal" && (
        <>
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
        </>
      )}

      {activeTab === "shared" && (
        <>
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
                onRename={t.mine || isAdmin ? (newTitle) => renameTemplate(t.id, newTitle) : undefined}
                actions={
                  t.mine || isAdmin
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
        </>
      )}

      {activeTab === "problems" && (
        <>
          <p className="muted">
            The problems you liked, for starting a session in one click. Browse the whole bank, organise it into
            folders and edit tasks in the{" "}
            <button className="link" onClick={() => navigate("/problems")}>
              Problem bank
            </button>
            .
          </p>
          <div className="liked-start-language">
            <label>
              Start in{" "}
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages
                  .filter((l) => TESTABLE_LANGUAGES.includes(l.key))
                  .map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
              </select>
            </label>
            <span className="muted">- the same choice as the language above; it picks which starter seeds the editor</span>
          </div>
          <CardGrid>
            {problems.map((p) => (
              <PreviewCard
                key={p.id}
                title={p.title}
                preview={p.description}
                footer={
                  creatingFromProblem === p.id
                    ? "Creating session…"
                    : `${"★".repeat(p.difficulty)}${"☆".repeat(5 - p.difficulty)} · ${p.likesCount} ♥ · ${(p.starterLanguages ?? []).map(languageLabel).join(", ") || "no starters"} · refreshed ${formatRelativeTime(p.updated_at)}`
                }
                onClick={() => createFromProblem(p)}
              />
            ))}
            {problems.length === 0 && (
              <div className="muted">Nothing liked yet - ♥ a problem in the Problem bank and it shows up here</div>
            )}
          </CardGrid>
        </>
      )}
    </div>
  );
}
