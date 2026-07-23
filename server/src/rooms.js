import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth, optionalAuth } from "./auth.js";
import { LANGUAGES } from "./judge0.js";
import { getLiveDocument, getRoomParticipantCount } from "./collabServer.js";
import { getRoomAccess } from "./roomAccess.js";
import { runTests } from "./testRunner.js";

export const router = Router();

const LANGUAGE_KEYS = new Set(LANGUAGES.map((l) => l.key));
const PREVIEW_LENGTH = 400;

function roomPreview(room) {
  const live = getLiveDocument(room.id);
  const code = live ? live.getText("code").toString() : room.last_code ?? room.initial_code ?? "";
  return code.slice(0, PREVIEW_LENGTH);
}

router.post("/", requireAuth, async (req, res) => {
  const { title, language, templateId, problemId } = req.body || {};
  let lang = LANGUAGE_KEYS.has(language) ? language : "python";
  let initialCode = null;
  let defaultTitle = "Interview session";
  let attachedProblemId = null;

  if (templateId) {
    const { rows } = await pool.query(
      "SELECT title, language, code FROM templates WHERE id = $1 AND (created_by = $2 OR is_shared = true)",
      [templateId, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "template not found" });
    lang = rows[0].language;
    initialCode = rows[0].code;
    defaultTitle = rows[0].title;
  } else if (problemId) {
    const { rows } = await pool.query(
      "SELECT id, title FROM problems WHERE id = $1 AND (created_by = $2 OR is_shared = true)",
      [problemId, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "problem not found" });
    // A problem's starter is per-language - the room's language decides
    // which one seeds the editor (falls back to whatever the "new session"
    // form already had selected if the problem has none for that language).
    const starter = await pool.query(
      "SELECT starter_code FROM problem_starters WHERE problem_id = $1 AND language = $2",
      [problemId, lang]
    );
    initialCode = starter.rows[0]?.starter_code ?? null;
    defaultTitle = rows[0].title;
    attachedProblemId = problemId;
  }

  const { rows } = await pool.query(
    `INSERT INTO rooms (title, language, created_by, initial_code, problem_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, title, language, created_at`,
    [title?.trim() || defaultTitle, lang, req.user.sub, initialCode, attachedProblemId]
  );
  res.status(201).json(rows[0]);
});

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, language, active, created_at, last_active_at, initial_code, last_code
     FROM rooms WHERE created_by = $1 AND active = true ORDER BY last_active_at DESC`,
    [req.user.sub]
  );
  res.json(
    rows.map((room) => {
      const preview = roomPreview(room);
      const { initial_code, last_code, ...rest } = room;
      return { ...rest, preview, participantCount: getRoomParticipantCount(room.id) };
    })
  );
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { title, runEnabled, testsEnabled, problemId } = req.body || {};
  if ([title, runEnabled, testsEnabled, problemId].every((v) => v === undefined)) {
    return res.status(400).json({ error: "nothing to update" });
  }
  if (title !== undefined && !title?.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  if (problemId) {
    const { rows } = await pool.query(
      "SELECT 1 FROM problems WHERE id = $1 AND (created_by = $2 OR is_shared = true)",
      [problemId, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "problem not found" });
  }

  const sets = [];
  const values = [];
  if (title !== undefined) {
    values.push(title.trim());
    sets.push(`title = $${values.length}`);
  }
  if (runEnabled !== undefined) {
    values.push(Boolean(runEnabled));
    sets.push(`run_enabled = $${values.length}`);
  }
  if (testsEnabled !== undefined) {
    values.push(Boolean(testsEnabled));
    sets.push(`tests_enabled = $${values.length}`);
  }
  // problemId: null explicitly detaches (candidate's editor keeps whatever
  // code is already there - only the "attached task" pointer changes here,
  // the frontend handles seeding the editor itself, same as inserting a
  // template does today).
  if (problemId !== undefined) {
    values.push(problemId || null);
    sets.push(`problem_id = $${values.length}`);
  }
  values.push(req.params.id, req.user.sub);

  const { rows } = await pool.query(
    `UPDATE rooms SET ${sets.join(", ")} WHERE id = $${values.length - 1} AND created_by = $${values.length}
     RETURNING id, title, language, active, created_at, last_active_at,
               run_enabled AS "runEnabled", tests_enabled AS "testsEnabled", problem_id AS "problemId"`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: "room not found" });
  res.json(rows[0]);
});

// Intentionally public: the room id itself (a UUIDv4) is the shared secret in
// the interview link, matching how most self-hosted "join by link" interview
// tools work. Candidates never need an account. created_by is just a UUID
// (no PII) - the frontend uses it to tell a real room owner apart from any
// other logged-in account that happens to open this link.
router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, language, active, created_by AS "createdBy", run_enabled AS "runEnabled",
            tests_enabled AS "testsEnabled", problem_id AS "problemId"
     FROM rooms WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0] || !rows[0].active) return res.status(404).json({ error: "room not found" });
  res.json(rows[0]);
});

// Interviewer-only, same as templates - this is their view into what a
// candidate has tried, not something the candidate side needs to read back.
router.get("/:id/submissions", requireAuth, async (req, res) => {
  const owns = await pool.query("SELECT 1 FROM rooms WHERE id = $1 AND created_by = $2", [
    req.params.id,
    req.user.sub,
  ]);
  if (!owns.rows[0]) return res.status(404).json({ error: "room not found" });

  const { rows } = await pool.query(
    `SELECT id, language, code, stdin, status, stdout, stderr, compile_output, submitted_by, created_at
     FROM submissions WHERE room_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.id]
  );
  res.json(rows);
});

// Public, same reasoning as GET /:id - the candidate-facing "Task" panel
// needs the assignment text and public examples without an account. Hidden
// test cases are never selected here at all, not just filtered out client
// side, so there's nothing to accidentally leak in this response.
router.get("/:id/problem", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT problem_id AS "problemId" FROM rooms WHERE id = $1 AND active = true`,
    [req.params.id]
  );
  const room = rows[0];
  if (!room) return res.status(404).json({ error: "room not found" });
  if (!room.problemId) return res.json(null);

  const { rows: problemRows } = await pool.query(
    `SELECT id, title, description, function_name AS "functionName", params, return_type AS "returnType"
     FROM problems WHERE id = $1`,
    [room.problemId]
  );
  const problem = problemRows[0];
  if (!problem) return res.json(null);

  const { rows: publicTests } = await pool.query(
    `SELECT id, name, args, expected FROM problem_tests
     WHERE problem_id = $1 AND is_hidden = false ORDER BY position ASC`,
    [room.problemId]
  );
  res.json({ ...problem, publicTests });
});

// mode: "run" (visible test cases only, fast feedback, not persisted) vs
// "submit" (every test case including hidden ones, persisted to
// test_runs). Mirrors the run_enabled gate exactly, but on tests_enabled.
router.post("/:id/tests", optionalAuth, async (req, res) => {
  const { code, mode, submittedBy } = req.body || {};
  if (mode !== "run" && mode !== "submit") {
    return res.status(400).json({ error: "mode must be 'run' or 'submit'" });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "code is required" });
  }

  const access = await getRoomAccess(req.params.id, req.user?.sub);
  if (!access) return res.status(404).json({ error: "room not found" });
  if (!access.isOwner && !access.room.tests_enabled) {
    return res.status(403).json({ error: "tests disabled by interviewer" });
  }
  if (!access.room.problemId) {
    return res.status(400).json({ error: "room has no problem attached" });
  }

  const { rows: problemRows } = await pool.query(
    `SELECT function_name AS "functionName", params, return_type AS "returnType" FROM problems WHERE id = $1`,
    [access.room.problemId]
  );
  const problem = problemRows[0];
  if (!problem) return res.status(404).json({ error: "problem not found" });

  const hiddenFilter = mode === "run" ? "AND is_hidden = false" : "";
  const { rows: testCases } = await pool.query(
    `SELECT id, name, args, expected, is_hidden AS "isHidden" FROM problem_tests
     WHERE problem_id = $1 ${hiddenFilter} ORDER BY position ASC`,
    [access.room.problemId]
  );
  if (testCases.length === 0) {
    return res.status(400).json({ error: "no test cases available" });
  }

  try {
    const { results, compileOutput, stderr, status } = await runTests({
      language: access.room.language,
      candidateCode: code,
      functionName: problem.functionName,
      returnType: problem.returnType,
      params: problem.params,
      testCases,
    });
    const passedCount = results.filter((r) => r.passed).length;

    if (mode === "submit") {
      await pool.query(
        `INSERT INTO test_runs (room_id, code, mode, results, passed_count, total_count, submitted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, code, mode, JSON.stringify(results), passedCount, results.length, submittedBy || "Anonymous"]
      );
    }

    // Redact hidden-case detail for non-owners - only name + pass/fail
    // survive; args/expected/actual/error could leak the intended answer.
    const visibleResults = access.isOwner
      ? results
      : results.map((r) => (r.isHidden ? { name: r.name, isHidden: true, passed: r.passed } : r));

    res.json({
      mode,
      passedCount,
      totalCount: results.length,
      results: visibleResults,
      compileOutput,
      stderr,
      status,
    });
  } catch (err) {
    console.error("run tests failed:", err.response?.data || err.message);
    res.status(502).json({ error: "test execution backend unavailable" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    "UPDATE rooms SET active = false WHERE id = $1 AND created_by = $2",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "room not found" });
  res.status(204).end();
});
