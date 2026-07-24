import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";

// Only these have a real test harness (server/src/testHarness/index.js) -
// mariadb doesn't fit the "author writes real test code" model at all.
const TESTABLE_LANGUAGES = ["python", "go", "cpp", "java", "bash"];
const MONACO_LANGUAGE = { python: "python", go: "go", cpp: "cpp", java: "java", bash: "shell" };

function emptyDraft() {
  return {
    id: null,
    title: "",
    description: "",
    signatureHint: "",
    difficulty: 3,
    folderId: null,
    shared: false,
    starters: TESTABLE_LANGUAGES.map((language) => ({ language, code: "" })),
    solutions: [],
    testCode: TESTABLE_LANGUAGES.map((language) => ({ language, publicCode: "", hiddenCode: "" })),
  };
}

function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= value ? "filled" : ""}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

export default function Problems() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(undefined); // undefined = All
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [draft, setDraft] = useState(null);
  const [activeLang, setActiveLang] = useState("python");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  function loadFolders() {
    return api.get("/problems/folders").then(({ data }) => setFolders(data));
  }

  function loadProblems(folderId) {
    const query = folderId === undefined ? "" : `?folderId=${encodeURIComponent(folderId ?? "")}`;
    return api.get(`/problems${query}`).then(({ data }) => setProblems(data));
  }

  useEffect(() => {
    loadFolders().catch(() => setError("Failed to load folders"));
  }, []);

  useEffect(() => {
    loadProblems(activeFolderId).catch(() => setError("Failed to load problems"));
  }, [activeFolderId]);

  async function createFolder(e) {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    try {
      await api.post("/problems/folders", { title: newFolderTitle.trim() });
      setNewFolderTitle("");
      await loadFolders();
    } catch {
      setError("Failed to create folder");
    }
  }

  async function deleteFolder(id) {
    if (!window.confirm("Delete this folder?")) return;
    try {
      await api.delete(`/problems/folders/${id}`);
      if (activeFolderId === id) setActiveFolderId(undefined);
      await loadFolders();
    } catch (err) {
      setError(err.response?.data?.error === "folder is not empty" ? "Folder is not empty - move or delete its problems first" : "Failed to delete folder");
    }
  }

  function startCreate() {
    setValidation(null);
    setActiveLang("python");
    setDraft({ ...emptyDraft(), folderId: activeFolderId || null });
  }

  async function startEdit(summary) {
    setValidation(null);
    setError("");
    setActiveLang("python");
    try {
      const { data } = await api.get(`/problems/${summary.id}`);
      setDraft(data);
    } catch {
      setError("Failed to load problem");
    }
  }

  async function deleteProblem(id) {
    if (!window.confirm("Delete this problem? This cannot be undone.")) return;
    try {
      await api.delete(`/problems/${id}`);
      await loadProblems(activeFolderId);
    } catch {
      setError("Failed to delete problem");
    }
  }

  async function toggleLike(problem) {
    try {
      await api.post(`/problems/${problem.id}/like`, {});
      await loadProblems(activeFolderId);
    } catch {
      setError("Failed to update like");
    }
  }

  function updateDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateStarter(language, code) {
    setDraft((d) => ({ ...d, starters: d.starters.map((s) => (s.language === language ? { ...s, code } : s)) }));
  }

  function updateTestCode(language, patch) {
    setDraft((d) => ({ ...d, testCode: d.testCode.map((t) => (t.language === language ? { ...t, ...patch } : t)) }));
  }

  function addSolution(language) {
    setDraft((d) => ({ ...d, solutions: [...d.solutions, { language, title: "", code: "" }] }));
  }

  function updateSolution(i, patch) {
    setDraft((d) => ({ ...d, solutions: d.solutions.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  }

  function removeSolution(i) {
    setDraft((d) => ({ ...d, solutions: d.solutions.filter((_s, j) => j !== i) }));
  }

  async function saveDraft() {
    if (!draft.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = draft.id ? await api.put(`/problems/${draft.id}`, draft) : await api.post("/problems", draft);
      setDraft(data);
      setValidation(null);
      await loadProblems(activeFolderId);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save problem");
    } finally {
      setSaving(false);
    }
  }

  async function validateSolutions() {
    if (!draft.id) {
      setError("Save the problem before validating its reference solutions");
      return;
    }
    setValidating(true);
    setValidation(null);
    try {
      const { data } = await api.post(`/problems/${draft.id}/validate`, {});
      setValidation(data.results);
    } catch (err) {
      setError(err.response?.data?.error || "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  const activeStarter = draft?.starters.find((s) => s.language === activeLang);
  const activeTestCode = draft?.testCode.find((t) => t.language === activeLang);

  return (
    <div className="dashboard">
      <header>
        <button className="link" onClick={() => navigate("/dashboard")}>
          ← Dashboard
        </button>
        <div>
          <strong>Problem bank</strong>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {!draft && (
        <div className="problems-layout">
          <div className="folder-sidebar">
            <button className={activeFolderId === undefined ? "active" : ""} onClick={() => setActiveFolderId(undefined)}>
              All problems
            </button>
            <button className={activeFolderId === null ? "active" : ""} onClick={() => setActiveFolderId(null)}>
              Unfiled
            </button>
            {folders.map((f) => (
              <div key={f.id} className="folder-row">
                <button className={activeFolderId === f.id ? "active" : ""} onClick={() => setActiveFolderId(f.id)}>
                  {f.title} ({f.problemCount})
                </button>
                <button className="link danger" onClick={() => deleteFolder(f.id)} title="Delete (only if empty)">
                  ×
                </button>
              </div>
            ))}
            <form onSubmit={createFolder} className="new-folder-form">
              <input placeholder="New folder…" value={newFolderTitle} onChange={(e) => setNewFolderTitle(e.target.value)} />
              <button type="submit">+</button>
            </form>
          </div>

          <div className="problems-main">
            <button onClick={startCreate}>New problem</button>
            <CardGrid>
              {problems.map((p) => (
                <PreviewCard
                  key={p.id}
                  title={p.title}
                  preview={p.description}
                  footer={`${"★".repeat(p.difficulty)}${"☆".repeat(5 - p.difficulty)} · ${p.shared ? "shared" : "personal"} · refreshed ${formatRelativeTime(p.updated_at)}`}
                  onClick={() => startEdit(p)}
                  actions={[
                    { key: "like", label: p.likedByMe ? `♥ Unlike (${p.likesCount})` : `♡ Like (${p.likesCount})`, onClick: () => toggleLike(p) },
                    ...(p.mine ? [{ key: "delete", label: "Delete", danger: true, onClick: () => deleteProblem(p.id) }] : []),
                  ]}
                />
              ))}
              {problems.length === 0 && <div className="muted">No problems yet</div>}
            </CardGrid>
          </div>
        </div>
      )}

      {draft && (
        <div className="problem-editor">
          <div className="problem-editor-row">
            <button className="link" onClick={() => setDraft(null)}>
              ← Back to list
            </button>
            <button onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : "Save problem"}
            </button>
          </div>

          <label>Title</label>
          <input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} />

          <label>Description (shown to the candidate)</label>
          <textarea rows={6} value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} />

          <label>Signature hint (optional, free text shown to the candidate)</label>
          <input
            placeholder="e.g. def is_palindrome(s: str) -> bool"
            value={draft.signatureHint}
            onChange={(e) => updateDraft({ signatureHint: e.target.value })}
          />

          <div className="problem-meta-row">
            <div>
              <label>Difficulty</label>
              <StarPicker value={draft.difficulty} onChange={(difficulty) => updateDraft({ difficulty })} />
            </div>
            <div>
              <label>Folder</label>
              <select value={draft.folderId ?? ""} onChange={(e) => updateDraft({ folderId: e.target.value || null })}>
                <option value="">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
            <label title={draft.id && !draft.mine ? "Only the problem's owner can change sharing" : ""}>
              <input
                type="checkbox"
                checked={draft.shared}
                disabled={Boolean(draft.id) && !draft.mine}
                onChange={(e) => updateDraft({ shared: e.target.checked })}
              />
              {" "}Share with all interviewers
            </label>
          </div>

          <div className="lang-tabs">
            {TESTABLE_LANGUAGES.map((l) => (
              <button key={l} className={activeLang === l ? "active" : ""} onClick={() => setActiveLang(l)}>
                {l}
              </button>
            ))}
          </div>

          <label>Starter code (shown to the candidate)</label>
          <Editor
            height="160px"
            language={MONACO_LANGUAGE[activeLang]}
            theme="vs-dark"
            value={activeStarter?.code || ""}
            onChange={(v) => updateStarter(activeLang, v ?? "")}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />

          <label>Public test code (real {activeLang} test code, shown to the candidate as runnable examples)</label>
          <Editor
            height="200px"
            language={MONACO_LANGUAGE[activeLang]}
            theme="vs-dark"
            value={activeTestCode?.publicCode || ""}
            onChange={(v) => updateTestCode(activeLang, { publicCode: v ?? "" })}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />

          <label>Hidden test code (real {activeLang} test code, never shown to the candidate)</label>
          <Editor
            height="200px"
            language={MONACO_LANGUAGE[activeLang]}
            theme="vs-dark"
            value={activeTestCode?.hiddenCode || ""}
            onChange={(v) => updateTestCode(activeLang, { hiddenCode: v ?? "" })}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />

          <h3 className="side-panel-subheading">
            Reference solutions in {activeLang} (authoring only - never shown to or run for candidates)
          </h3>
          {draft.solutions
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.language === activeLang)
            .map(({ s, i }) => (
              <div key={i} className="problem-solution-block">
                <div className="problem-solution-row">
                  <input
                    placeholder="e.g. brute force, optimal O(n)"
                    value={s.title}
                    onChange={(e) => updateSolution(i, { title: e.target.value })}
                  />
                  <button className="link danger" onClick={() => removeSolution(i)}>
                    Remove
                  </button>
                </div>
                <Editor
                  height="180px"
                  language={MONACO_LANGUAGE[activeLang]}
                  theme="vs-dark"
                  value={s.code}
                  onChange={(v) => updateSolution(i, { code: v ?? "" })}
                  options={{ fontSize: 13, minimap: { enabled: false } }}
                />
                {validation?.find((v) => v.solutionId === s.id) && (
                  <ValidationSummary result={validation.find((v) => v.solutionId === s.id)} />
                )}
              </div>
            ))}
          <button className="link" onClick={() => addSolution(activeLang)}>
            + Add reference solution ({activeLang})
          </button>
          {draft.solutions.length > 0 && (
            <div>
              <button onClick={validateSolutions} disabled={validating}>
                {validating ? "Validating…" : "Validate all solutions against tests"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ValidationSummary({ result }) {
  if (result.error) return <div className="error">{result.error}</div>;
  return (
    <div className={result.allPassed ? "muted" : "error"}>
      {result.allPassed ? "✅" : "❌"} {result.passedCount}/{result.totalCount} tests passed
    </div>
  );
}
