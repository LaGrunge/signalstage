import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth, optionalAuth } from "./auth.js";
import { LANGUAGES } from "./judge0.js";
import { getLiveDocument, getRoomParticipantCount, closeRoomConnections } from "./collabServer.js";
import { getRoomAccess } from "./roomAccess.js";
import { runProblemTests } from "./testRunner.js";

export const router = Router();

const LANGUAGE_KEYS = new Set(LANGUAGES.map((l) => l.key));
const PREVIEW_LENGTH = 400;

// Auto-idle fallback for "session over": a room nobody has touched for this
// long, with nobody connected, counts as ended for UI purposes (Dashboard
// badge/actions). Derived at read time - nothing stamps ended_at, so joining
// such a room simply revives it. Explicit "End session" is the hard state.
const IDLE_ENDED_MS = 12 * 60 * 60 * 1000;

function effectivelyEnded(room) {
  if (room.ended_at) return true;
  const idleMs = Date.now() - new Date(room.last_active_at).getTime();
  return idleMs > IDLE_ENDED_MS && getRoomParticipantCount(room.id) === 0;
}

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

// Default view is "sessions I took part in" - the ones I created plus the
// ones I actually joined (room_participants, recorded in GET /:id below).
// ?scope=all opens it up to every interviewer's sessions, which is what the
// dashboard's checkbox toggles: co-interviewers need to find a session they
// sat in on, and reviewers need to find one they didn't.
router.get("/", requireAuth, async (req, res) => {
  const all = req.query.scope === "all";
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.language, r.active, r.created_at, r.last_active_at, r.ended_at,
            r.initial_code, r.last_code, (r.created_by = $1) AS mine, u.name AS "ownerName"
     FROM rooms r
     JOIN users u ON u.id = r.created_by
     WHERE r.active = true
       ${all ? "" : "AND (r.created_by = $1 OR EXISTS (SELECT 1 FROM room_participants p WHERE p.room_id = r.id AND p.user_id = $1))"}
     ORDER BY r.last_active_at DESC`,
    [req.user.sub]
  );
  res.json(
    rows.map((room) => {
      const preview = roomPreview(room);
      const ended = effectivelyEnded(room);
      const { initial_code, last_code, ...rest } = room;
      return {
        ...rest,
        preview,
        participantCount: getRoomParticipantCount(room.id),
        effectivelyEnded: ended,
      };
    })
  );
});

// Explicitly finish a session: locks the room for the candidate (new collab
// connections are rejected via roomExists, live ones are kicked) while
// keeping it on the dashboard for playback - unlike DELETE, which hides the
// room forever. Idempotent: re-ending keeps the original ended_at.
router.post("/:id/end", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE rooms SET ended_at = COALESCE(ended_at, now())
     WHERE id = $1 AND (created_by = $2 OR $3)
     RETURNING ended_at AS "endedAt"`,
    [req.params.id, req.user.sub, req.user.isAdmin]
  );
  if (!rows[0]) return res.status(404).json({ error: "room not found" });
  closeRoomConnections(req.params.id);
  await pool.query("INSERT INTO room_events (room_id, kind, actor) VALUES ($1, 'ended', $2)", [
    req.params.id,
    req.user.email ?? null,
  ]);
  res.json(rows[0]);
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { title, runEnabled, testsEnabled, copyPasteBlocked, problemId } = req.body || {};
  if ([title, runEnabled, testsEnabled, copyPasteBlocked, problemId].every((v) => v === undefined)) {
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
  if (copyPasteBlocked !== undefined) {
    values.push(Boolean(copyPasteBlocked));
    sets.push(`copy_paste_blocked = $${values.length}`);
  }
  // problemId: null explicitly detaches (candidate's editor keeps whatever
  // code is already there - only the "attached task" pointer changes here,
  // the frontend handles seeding the editor itself, same as inserting a
  // template does today).
  if (problemId !== undefined) {
    values.push(problemId || null);
    sets.push(`problem_id = $${values.length}`);
  }
  values.push(req.params.id, req.user.sub, req.user.isAdmin);

  const { rows } = await pool.query(
    `UPDATE rooms SET ${sets.join(", ")}
     WHERE id = $${values.length - 2} AND (created_by = $${values.length - 1} OR $${values.length})
     RETURNING id, title, language, active, created_at, last_active_at,
               run_enabled AS "runEnabled", tests_enabled AS "testsEnabled",
               copy_paste_blocked AS "copyPasteBlocked", problem_id AS "problemId"`,
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
router.get("/:id", optionalAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, language, active, created_by AS "createdBy", run_enabled AS "runEnabled",
            tests_enabled AS "testsEnabled", copy_paste_blocked AS "copyPasteBlocked",
            problem_id AS "problemId", ended_at AS "endedAt"
     FROM rooms WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0] || !rows[0].active) return res.status(404).json({ error: "room not found" });

  // Opening the room page while logged in is what makes someone a
  // participant of it (this is the one request every interviewer joining a
  // session makes, candidates included - they just aren't authenticated, so
  // nothing is recorded for them). Best effort: failing to record
  // participation must not keep anyone out of the room.
  if (req.user) {
    pool
      .query(
        `INSERT INTO room_participants (room_id, user_id, source) VALUES ($1, $2, 'visit')
         ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = now(), source = 'visit'`,
        [req.params.id, req.user.sub]
      )
      .catch((err) => console.error("failed to record participation:", err.message));
  }
  res.json(rows[0]);
});

// Interviewer-only, same as templates - this is their view into what a
// candidate has tried, not something the candidate side needs to read back.
// Any signed-in interviewer, not just the room's creator: co-interviewers
// share a session and the dashboard can list every interviewer's rooms
// (GET /?scope=all), so an owner-only rule here would leave a visible room
// with a panel that 404s. Mutating a session (end/rename/delete) is still
// owner-only.
router.get("/:id/submissions", requireAuth, async (req, res) => {
  const exists = await pool.query("SELECT 1 FROM rooms WHERE id = $1", [req.params.id]);
  if (!exists.rows[0]) return res.status(404).json({ error: "room not found" });

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
    `SELECT id, title, description, signature_hint AS "signatureHint" FROM problems WHERE id = $1`,
    [room.problemId]
  );
  const problem = problemRows[0];
  if (!problem) return res.json(null);

  // Only public test code, per language - hidden_code is never selected
  // here at all, not just filtered out client-side, so there's nothing to
  // accidentally leak in this response.
  const { rows: testCode } = await pool.query(
    `SELECT language, public_code AS "publicCode" FROM problem_test_code WHERE problem_id = $1`,
    [room.problemId]
  );
  res.json({ ...problem, testCode });
});

// mode: "run" (public test code only, fast feedback) vs "submit" (public
// AND hidden test code). Both are persisted to test_runs - submit is the
// graded attempt, run clicks feed the playback timeline. Mirrors the
// run_enabled gate exactly, but on tests_enabled.
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

  const { rows: testCodeRows } = await pool.query(
    `SELECT public_code AS "publicCode", hidden_code AS "hiddenCode"
     FROM problem_test_code WHERE problem_id = $1 AND language = $2`,
    [access.room.problemId, access.room.language]
  );
  const tc = testCodeRows[0];
  if (!tc || (!tc.publicCode?.trim() && !tc.hiddenCode?.trim())) {
    return res.status(400).json({ error: "no test code available for this language" });
  }

  try {
    const { results, compileOutput, stderr, status } = await runProblemTests({
      language: access.room.language,
      candidateCode: code,
      publicTestCode: tc.publicCode,
      hiddenTestCode: tc.hiddenCode,
      mode,
    });
    const passedCount = results.filter((r) => r.passed).length;

    // Every mode is persisted: "submit" is the graded attempt, but "run"
    // clicks are timeline markers for session playback too.
    await pool.query(
      `INSERT INTO test_runs (room_id, code, mode, results, passed_count, total_count, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, code, mode, JSON.stringify(results), passedCount, results.length, submittedBy || "Anonymous"]
    );

    // Redact hidden-case detail for non-owners - only name + pass/fail
    // survive; the failure message could leak the intended answer.
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

// Everything the playback page needs in one shot: the ordered Yjs update
// log (base64, keyframe rows reset the replay doc - see 011_playback.sql)
// plus all timeline events (participant joins/leaves, code runs, test runs)
// merged and sorted. Any signed-in interviewer, same as /submissions -
// co-interviewers need to replay a session they sat in on, and the dashboard
// can list sessions they didn't. Deliberately does NOT filter on
// active/ended - ended and even ongoing sessions are replayable.
router.get("/:id/playback", requireAuth, async (req, res) => {
  const { rows: roomRows } = await pool.query(
    `SELECT title, language, created_at AS "createdAt", ended_at AS "endedAt", last_code AS "lastCode"
     FROM rooms WHERE id = $1`,
    [req.params.id]
  );
  if (!roomRows[0]) return res.status(404).json({ error: "room not found" });

  const UPDATE_LIMIT = 200000;
  const [updates, submissions, testRuns, roomEvents] = await Promise.all([
    pool.query(
      `SELECT actor, update, is_keyframe AS k, created_at
       FROM yjs_updates WHERE room_id = $1 ORDER BY id LIMIT ${UPDATE_LIMIT}`,
      [req.params.id]
    ),
    pool.query(
      `SELECT id, language, status, stdout, stderr, compile_output, code, submitted_by, created_at
       FROM submissions WHERE room_id = $1 ORDER BY created_at`,
      [req.params.id]
    ),
    pool.query(
      `SELECT mode, results, passed_count, total_count, submitted_by, created_at
       FROM test_runs WHERE room_id = $1 ORDER BY created_at`,
      [req.params.id]
    ),
    pool.query(
      `SELECT kind, actor, created_at FROM room_events WHERE room_id = $1 ORDER BY created_at`,
      [req.params.id]
    ),
  ]);

  const events = [
    ...roomEvents.rows.map((e) => ({
      t: e.created_at.getTime(),
      kind: e.kind, // 'join' | 'leave' | 'ended'
      actor: e.actor,
    })),
    ...submissions.rows.map((s) => ({
      t: s.created_at.getTime(),
      kind: "run",
      actor: s.submitted_by,
      status: s.status,
      stdout: s.stdout,
      stderr: s.stderr,
      compileOutput: s.compile_output,
      code: s.code,
      language: s.language,
    })),
    ...testRuns.rows.map((tr) => ({
      t: tr.created_at.getTime(),
      kind: tr.mode === "submit" ? "test_submit" : "test_run",
      actor: tr.submitted_by,
      passedCount: tr.passed_count,
      totalCount: tr.total_count,
      results: tr.results,
    })),
  ].sort((a, b) => a.t - b.t);

  res.json({
    meta: {
      ...roomRows[0],
      updateCount: updates.rows.length,
      truncated: updates.rows.length === UPDATE_LIMIT,
    },
    updates: updates.rows.map((u) => ({
      t: u.created_at.getTime(),
      a: u.actor,
      k: u.k || undefined,
      u: u.update.toString("base64"),
    })),
    events,
  });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    "UPDATE rooms SET active = false WHERE id = $1 AND (created_by = $2 OR $3)",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "room not found" });
  res.status(204).end();
});
