import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { formatRelativeTime } from "../lib/time.js";
import { CardGrid, PreviewCard } from "../components/Cards.jsx";

// Mirrors server/src/testHarness/types.js's v1 type system - keep in sync.
const TYPE_OPTIONS = ["int", "double", "bool", "string", "int[]", "double[]", "string[]"];
// Only these have a test harness (server/src/testHarness/index.js) - bash/
// mariadb don't fit the "candidate implements one function" model.
const TESTABLE_LANGUAGES = ["python", "go", "cpp", "java"];

function emptyDraft() {
  return {
    id: null,
    title: "",
    description: "",
    functionName: "",
    returnType: "int",
    shared: false,
    params: [{ name: "", type: "int" }],
    starters: TESTABLE_LANGUAGES.map((language) => ({ language, code: "" })),
    solutions: [],
    tests: [],
  };
}

// Array/int/double/bool params are typed via JSON syntax in the input
// (e.g. "[2, 7, 11, 15]", "true") - only plain strings are taken as raw
// text, since JSON-quoting every string field would be needless friction.
function parseValue(type, raw) {
  if (type === "string") return raw;
  return JSON.parse(raw);
}

function stringifyValue(type, value) {
  if (type === "string") return value ?? "";
  if (value === undefined) return type.endsWith("[]") ? "[]" : "";
  return JSON.stringify(value);
}

export default function Problems() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  function loadProblems() {
    return api.get("/problems").then(({ data }) => setProblems(data));
  }

  useEffect(() => {
    loadProblems().catch(() => setError("Failed to load problems"));
  }, []);

  function startCreate() {
    setValidation(null);
    setDraft(emptyDraft());
  }

  async function startEdit(summary) {
    setValidation(null);
    setError("");
    try {
      const { data } = await api.get(`/problems/${summary.id}`);
      // Server returns real JSON values (numbers/arrays/etc) for args and
      // expected - the editor's inputs always hold the JSON-syntax string
      // form (see parseValue/stringifyValue), so convert once on load.
      const tests = data.tests.map((t) => ({
        ...t,
        args: data.params.map((p, i) => stringifyValue(p.type, t.args[i])),
        expected: stringifyValue(data.returnType, t.expected),
      }));
      setDraft({ ...data, tests });
    } catch {
      setError("Failed to load problem");
    }
  }

  async function deleteProblem(id) {
    if (!window.confirm("Delete this problem? This cannot be undone.")) return;
    try {
      await api.delete(`/problems/${id}`);
      await loadProblems();
    } catch {
      setError("Failed to delete problem");
    }
  }

  function updateDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateParam(i, patch) {
    setDraft((d) => ({ ...d, params: d.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  }

  function addParam() {
    setDraft((d) => ({ ...d, params: [...d.params, { name: "", type: "int" }] }));
  }

  function removeParam(i) {
    setDraft((d) => ({ ...d, params: d.params.filter((_p, j) => j !== i) }));
  }

  function updateStarter(language, code) {
    setDraft((d) => ({
      ...d,
      starters: d.starters.map((s) => (s.language === language ? { ...s, code } : s)),
    }));
  }

  function addSolution() {
    setDraft((d) => ({ ...d, solutions: [...d.solutions, { language: TESTABLE_LANGUAGES[0], title: "", code: "" }] }));
  }

  function updateSolution(i, patch) {
    setDraft((d) => ({ ...d, solutions: d.solutions.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  }

  function removeSolution(i) {
    setDraft((d) => ({ ...d, solutions: d.solutions.filter((_s, j) => j !== i) }));
  }

  function addTest() {
    setDraft((d) => ({
      ...d,
      tests: [...d.tests, { name: "", args: d.params.map(() => ""), expected: "", isHidden: true }],
    }));
  }

  function updateTestField(i, patch) {
    setDraft((d) => ({ ...d, tests: d.tests.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }

  function updateTestArg(i, argIndex, raw) {
    setDraft((d) => ({
      ...d,
      tests: d.tests.map((t, j) => {
        if (j !== i) return t;
        const args = [...t.args];
        args[argIndex] = raw;
        return { ...t, args };
      }),
    }));
  }

  function removeTest(i) {
    setDraft((d) => ({ ...d, tests: d.tests.filter((_t, j) => j !== i) }));
  }

  function buildPayload() {
    // Tests are edited as raw text in the UI (args/expected inputs hold
    // strings even for numeric/array types) - parse them into real JSON
    // values against each param's declared type right before saving.
    const tests = draft.tests.map((t) => ({
      name: t.name,
      isHidden: Boolean(t.isHidden),
      args: draft.params.map((p, i) => parseValue(p.type, t.args[i] ?? "")),
      expected: parseValue(draft.returnType, t.expected ?? ""),
    }));
    return { ...draft, tests };
  }

  async function saveDraft() {
    if (!draft.title.trim() || !draft.functionName.trim()) {
      setError("Title and function name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      const { data } = draft.id
        ? await api.put(`/problems/${draft.id}`, payload)
        : await api.post("/problems", payload);
      // Same re-stringify as startEdit - the response holds real JSON
      // values, but the editor's test inputs always hold JSON-syntax text.
      const tests = data.tests.map((t) => ({
        ...t,
        args: data.params.map((p, i) => stringifyValue(p.type, t.args[i])),
        expected: stringifyValue(data.returnType, t.expected),
      }));
      setDraft({ ...data, tests });
      setValidation(null);
      await loadProblems();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save problem - check that test args/expected are valid values for each param's type");
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
        <>
          <button onClick={startCreate}>New problem</button>
          <h2>Problems</h2>
          <CardGrid>
            {problems.map((p) => (
              <PreviewCard
                key={p.id}
                title={p.title}
                preview={p.description}
                footer={`${p.functionName} · ${p.shared ? "shared" : "personal"} · refreshed ${formatRelativeTime(p.updated_at)}`}
                onClick={() => startEdit(p)}
                actions={p.mine ? [{ key: "delete", label: "Delete", danger: true, onClick: () => deleteProblem(p.id) }] : []}
              />
            ))}
            {problems.length === 0 && <div className="muted">No problems yet</div>}
          </CardGrid>
        </>
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

          <label>
            <input type="checkbox" checked={draft.shared} onChange={(e) => updateDraft({ shared: e.target.checked })} />
            {" "}Share with all interviewers
          </label>

          <h3 className="side-panel-subheading">Function signature</h3>
          <div className="problem-signature-row">
            <input
              placeholder="functionName"
              value={draft.functionName}
              onChange={(e) => updateDraft({ functionName: e.target.value })}
            />
            <span className="muted">returns</span>
            <select value={draft.returnType} onChange={(e) => updateDraft({ returnType: e.target.value })}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {draft.params.map((p, i) => (
            <div key={i} className="problem-param-row">
              <input placeholder="param name" value={p.name} onChange={(e) => updateParam(i, { name: e.target.value })} />
              <select value={p.type} onChange={(e) => updateParam(i, { type: e.target.value })}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button className="link danger" onClick={() => removeParam(i)}>
                Remove
              </button>
            </div>
          ))}
          <button className="link" onClick={addParam}>
            + Add parameter
          </button>

          <h3 className="side-panel-subheading">Starter code (per language, shown to the candidate)</h3>
          {draft.starters.map((s) => (
            <div key={s.language} className="problem-starter-block">
              <label>{s.language}</label>
              <textarea rows={4} value={s.code} onChange={(e) => updateStarter(s.language, e.target.value)} />
            </div>
          ))}

          <h3 className="side-panel-subheading">
            Reference solutions (authoring only - never shown to or run for candidates)
          </h3>
          {draft.solutions.map((s, i) => (
            <div key={i} className="problem-solution-block">
              <div className="problem-solution-row">
                <select value={s.language} onChange={(e) => updateSolution(i, { language: e.target.value })}>
                  {TESTABLE_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="e.g. brute force, optimal O(n)"
                  value={s.title}
                  onChange={(e) => updateSolution(i, { title: e.target.value })}
                />
                <button className="link danger" onClick={() => removeSolution(i)}>
                  Remove
                </button>
              </div>
              <textarea rows={6} value={s.code} onChange={(e) => updateSolution(i, { code: e.target.value })} />
              {validation?.find((v) => v.solutionId === s.id) && (
                <ValidationSummary result={validation.find((v) => v.solutionId === s.id)} />
              )}
            </div>
          ))}
          <button className="link" onClick={addSolution}>
            + Add reference solution
          </button>
          {draft.solutions.length > 0 && (
            <div>
              <button onClick={validateSolutions} disabled={validating}>
                {validating ? "Validating…" : "Validate all solutions against tests"}
              </button>
            </div>
          )}

          <h3 className="side-panel-subheading">Test cases</h3>
          {draft.tests.map((t, i) => (
            <div key={i} className="problem-test-block">
              <div className="problem-test-row">
                <input placeholder="case name" value={t.name} onChange={(e) => updateTestField(i, { name: e.target.value })} />
                <label>
                  <input
                    type="checkbox"
                    checked={t.isHidden}
                    onChange={(e) => updateTestField(i, { isHidden: e.target.checked })}
                  />
                  {" "}hidden
                </label>
                <button className="link danger" onClick={() => removeTest(i)}>
                  Remove
                </button>
              </div>
              <div className="problem-test-args">
                {draft.params.map((p, j) => (
                  <input
                    key={j}
                    placeholder={`${p.name || `arg${j}`} (${p.type})`}
                    value={t.args[j] ?? ""}
                    onChange={(e) => updateTestArg(i, j, e.target.value)}
                  />
                ))}
                <input
                  placeholder={`expected (${draft.returnType})`}
                  value={t.expected ?? ""}
                  onChange={(e) => updateTestField(i, { expected: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button className="link" onClick={addTest}>
            + Add test case
          </button>
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
