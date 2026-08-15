import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { api, useIsAdmin } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";
import { highlightCode } from "../lib/highlight.js";
import TopNav from "../components/TopNav.jsx";
import ProblemTree from "../components/ProblemTree.jsx";
import { DEFAULT_LANGUAGE, TESTABLE_LANGUAGES, languageLabel, orderLanguages } from "../lib/languages.js";

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

// The authoring form edits one language tab at a time by *updating* the entry
// for that language, so a problem that arrives with starters in only some
// languages (every seeded one, and anything written C++-first) has to be
// padded out here - otherwise typing into an absent language's tab silently
// does nothing and there is no way to add that language at all. saveDraft
// strips the still-empty ones back out again.
function withEveryLanguage(problem) {
  return {
    ...problem,
    starters: TESTABLE_LANGUAGES.map((language) => ({
      language,
      code: problem.starters.find((s) => s.language === language)?.code ?? "",
    })),
    testCode: TESTABLE_LANGUAGES.map((language) => {
      const existing = problem.testCode.find((t) => t.language === language);
      return {
        language,
        publicCode: existing?.publicCode ?? "",
        hiddenCode: existing?.hiddenCode ?? "",
      };
    }),
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
  const isAdmin = useIsAdmin();
  const [problems, setProblems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(null); // tree node data: folder, problem, or null = root
  const [openFolders, setOpenFolders] = useState({}); // survives the tree unmounting while a problem is open
  const [preview, setPreview] = useState(null); // full problem behind the selected leaf
  const [previewLang, setPreviewLang] = useState(DEFAULT_LANGUAGE);
  const [draft, setDraft] = useState(null);
  const [activeLang, setActiveLang] = useState(DEFAULT_LANGUAGE);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  // The tree needs the whole bank at once (a per-folder fetch would make
  // expanding a node a round trip), so everything is loaded here and the
  // right-hand pane filters locally.
  function reload() {
    return Promise.all([
      api.get("/problems/folders").then(({ data }) => setFolders(data)),
      api.get("/problems").then(({ data }) => setProblems(data)),
    ]);
  }

  useEffect(() => {
    reload().catch(() => setError("Failed to load the problem bank"));
  }, []);

  // Selecting a problem in the tree used to show nothing at all, because the
  // right pane only ever listed a folder's contents. Load the full problem
  // (the list payload has no starters or test code) and show it there.
  const selectedProblemId = selected?.kind === "problem" ? selected.problem.id : null;
  useEffect(() => {
    if (!selectedProblemId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/problems/${selectedProblemId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setPreview(data);
        const withStarter = data.starters.find((s) => s.code.trim());
        setPreviewLang(withStarter?.language ?? DEFAULT_LANGUAGE);
      })
      .catch(() => !cancelled && setError("Failed to load problem"));
    return () => {
      cancelled = true;
    };
  }, [selectedProblemId]);

  const selectedFolder = selected?.kind === "folder" ? selected : null;
  const selectedFolderId = selectedFolder?.folderId ?? null;
  const visibleProblems = problems.filter((p) => (p.folderId ?? null) === selectedFolderId);

  function reportFolderError(err, fallback) {
    const message = err.response?.data?.error;
    setError(
      message === "folder is not empty"
        ? "Folder is not empty - move or delete what's inside it first"
        : message || fallback
    );
  }

  async function createFolder(path) {
    setError("");
    try {
      const { data } = await api.post("/problems/folders", { path });
      await reload();
      return data;
    } catch (err) {
      reportFolderError(err, "Failed to create folder");
      return null;
    }
  }

  async function renameFolder(id, path) {
    setError("");
    try {
      await api.patch(`/problems/folders/${id}`, { path });
      await reload();
    } catch (err) {
      reportFolderError(err, "Failed to rename folder");
    }
  }

  async function deleteFolder(id) {
    setError("");
    try {
      await api.delete(`/problems/folders/${id}`);
      if (selectedFolderId === id) setSelected(null);
      await reload();
    } catch (err) {
      reportFolderError(err, "Failed to delete folder");
    }
  }

  async function renameProblem(id, title) {
    setError("");
    try {
      await api.patch(`/problems/${id}`, { title });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to rename problem");
    }
  }

  async function moveProblem(id, folderId) {
    setError("");
    try {
      await api.patch(`/problems/${id}`, { folderId });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to move problem");
    }
  }

  function startCreate() {
    setValidation(null);
    setActiveLang(DEFAULT_LANGUAGE);
    setDraft({ ...emptyDraft(), folderId: selectedFolderId });
  }

  async function startEdit(summary) {
    setValidation(null);
    setError("");
    setActiveLang(DEFAULT_LANGUAGE);
    try {
      const { data } = await api.get(`/problems/${summary.id}`);
      setDraft(withEveryLanguage(data));
    } catch {
      setError("Failed to load problem");
    }
  }

  async function deleteProblem(id) {
    if (!window.confirm("Delete this problem? This cannot be undone.")) return;
    try {
      await api.delete(`/problems/${id}`);
      await reload();
    } catch {
      setError("Failed to delete problem");
    }
  }

  async function toggleLike(problem) {
    try {
      await api.post(`/problems/${problem.id}/like`, {});
      await reload();
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
      // Empty tabs are not content: a problem written only in C++ should stay
      // a C++-only problem rather than gaining four blank starters that the
      // preview and the session seeding then have to filter back out.
      const payload = {
        ...draft,
        starters: draft.starters.filter((s) => s.code.trim()),
        testCode: draft.testCode.filter((t) => t.publicCode.trim() || t.hiddenCode.trim()),
      };
      const { data } = draft.id ? await api.put(`/problems/${draft.id}`, payload) : await api.post("/problems", payload);
      setDraft(withEveryLanguage(data));
      setValidation(null);
      await reload();
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
      <TopNav />

      {error && <div className="error">{error}</div>}

      {!draft && (
        <div className="problems-layout">
          <ProblemTree
            folders={folders}
            problems={problems}
            openState={openFolders}
            onOpenChange={(id, isOpen) => setOpenFolders((state) => ({ ...state, [id]: isOpen }))}
            onSelect={setSelected}
            onOpenProblem={startEdit}
            createFolder={createFolder}
            renameFolder={renameFolder}
            deleteFolder={deleteFolder}
            renameProblem={renameProblem}
            moveProblem={moveProblem}
            deleteProblem={deleteProblem}
          />

          <div className="problems-main">
            {preview ? (
              <ProblemPreview
                problem={preview}
                language={previewLang}
                onLanguage={setPreviewLang}
                onEdit={() => startEdit(preview)}
                onLike={() => toggleLike(preview).then(() => setPreview((p) => p && { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) }))}
              />
            ) : (
            <>
            <div className="problems-main-header">
              <span className="breadcrumb">{selectedFolder ? selectedFolder.path : "/"}</span>
              <button onClick={startCreate}>New problem here</button>
            </div>
            <p className="muted">
              Drag problems and folders in the tree to move them, double-click a problem to edit it, F2 to
              rename. Folders map to directories, so this is the structure the bank will keep when it moves
              into a Git repo.
            </p>
            <CardGrid>
              {visibleProblems.map((p) => (
                <PreviewCard
                  key={p.id}
                  title={p.title}
                  preview={p.description}
                  footer={`${"★".repeat(p.difficulty)}${"☆".repeat(5 - p.difficulty)} · ${p.shared ? "shared" : "personal"} · refreshed ${formatRelativeTime(p.updated_at)}`}
                  onClick={() => startEdit(p)}
                  actions={[
                    { key: "like", label: p.likedByMe ? `♥ Unlike (${p.likesCount})` : `♡ Like (${p.likesCount})`, onClick: () => toggleLike(p) },
                    ...(p.mine || isAdmin
                      ? [{ key: "delete", label: "Delete", danger: true, onClick: () => deleteProblem(p.id) }]
                      : []),
                  ]}
                />
              ))}
              {visibleProblems.length === 0 && (
                <div className="muted">
                  {selectedFolder ? "This folder has no problems of its own" : "No problems at the top level"}
                </div>
              )}
            </CardGrid>
            </>
            )}
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
                <option value="">/ (top level)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </select>
            </div>
            <label title={draft.id && !draft.mine && !isAdmin ? "Only the problem's owner can change sharing" : ""}>
              <input
                type="checkbox"
                checked={draft.shared}
                disabled={Boolean(draft.id) && !draft.mine && !isAdmin}
                onChange={(e) => updateDraft({ shared: e.target.checked })}
              />
              {" "}Share with all interviewers
            </label>
          </div>

          <div className="lang-tabs">
            {TESTABLE_LANGUAGES.map((l) => (
              <button key={l} className={activeLang === l ? "active" : ""} onClick={() => setActiveLang(l)}>
                {languageLabel(l)}
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

          <label>Public test code (real {languageLabel(activeLang)} test code, shown to the candidate as runnable examples)</label>
          <Editor
            height="200px"
            language={MONACO_LANGUAGE[activeLang]}
            theme="vs-dark"
            value={activeTestCode?.publicCode || ""}
            onChange={(v) => updateTestCode(activeLang, { publicCode: v ?? "" })}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />

          <label>Hidden test code (real {languageLabel(activeLang)} test code, never shown to the candidate)</label>
          <Editor
            height="200px"
            language={MONACO_LANGUAGE[activeLang]}
            theme="vs-dark"
            value={activeTestCode?.hiddenCode || ""}
            onChange={(v) => updateTestCode(activeLang, { hiddenCode: v ?? "" })}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />

          <h3 className="side-panel-subheading">
            Reference solutions in {languageLabel(activeLang)} (authoring only - never shown to or run for candidates)
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
            + Add reference solution ({languageLabel(activeLang)})
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

// The selected problem, blown up to fill the pane the folder listing would
// otherwise use - description in full, plus the starter a candidate would
// actually see, so picking a task doesn't require opening the editor for it.
function ProblemPreview({ problem, language, onLanguage, onEdit, onLike }) {
  const languages = orderLanguages(problem.starters.filter((s) => s.code.trim()).map((s) => s.language));
  const starter = problem.starters.find((s) => s.language === language)?.code ?? "";
  return (
    <div className="problem-preview">
      <div className="problem-preview-header">
        <div>
          <strong className="problem-preview-title">{problem.title}</strong>
          <div className="muted">
            {"★".repeat(problem.difficulty)}
            {"☆".repeat(5 - problem.difficulty)} · {problem.shared ? "shared" : "personal"} · refreshed{" "}
            {formatRelativeTime(problem.updated_at)}
          </div>
        </div>
        <div className="problem-preview-actions">
          <button className="link" onClick={onLike}>
            {problem.likedByMe ? `♥ Unlike (${problem.likesCount})` : `♡ Like (${problem.likesCount})`}
          </button>
          <button onClick={onEdit}>Edit problem</button>
        </div>
      </div>

      <div className="problem-preview-body">
        <label>Description</label>
        <p className="task-description">{problem.description || "No description yet"}</p>
        {problem.signatureHint && (
          <p className="muted">
            Signature: <code>{problem.signatureHint}</code>
          </p>
        )}

        {languages.length > 0 && (
          <>
            <div className="lang-tabs">
              {languages.map((l) => (
                <button key={l} className={l === language ? "active" : ""} onClick={() => onLanguage(l)}>
                  {languageLabel(l)}
                </button>
              ))}
            </div>
            <label>Starter code</label>
            <pre className="problem-preview-code">
              <code className="hljs" dangerouslySetInnerHTML={highlightCode(starter, language)} />
            </pre>
          </>
        )}
      </div>
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
