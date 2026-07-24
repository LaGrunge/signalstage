import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import { runProblemTests } from "./testRunner.js";
import { harnessFor } from "./testHarness/index.js";

export const router = Router();

router.use(requireAuth);

// --- Folders: flat (no nesting), shared across every interviewer like the
// problems inside them - deleting one only succeeds if it's actually empty,
// same "ask, don't cascade" rule real folder UIs use. ---
router.get("/folders", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.id, f.title, f.created_at, count(p.id)::int AS "problemCount"
     FROM problem_folders f LEFT JOIN problems p ON p.folder_id = f.id
     GROUP BY f.id ORDER BY f.title ASC`
  );
  res.json(rows);
});

router.post("/folders", async (req, res) => {
  const { title } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  const { rows } = await pool.query(
    "INSERT INTO problem_folders (title, created_by) VALUES ($1, $2) RETURNING id, title, created_at, 0 AS \"problemCount\"",
    [title.trim(), req.user.sub]
  );
  res.status(201).json(rows[0]);
});

router.delete("/folders/:id", async (req, res) => {
  const owns = await pool.query("SELECT 1 FROM problem_folders WHERE id = $1 AND created_by = $2", [
    req.params.id,
    req.user.sub,
  ]);
  if (!owns.rows[0]) return res.status(404).json({ error: "folder not found" });

  const { rows } = await pool.query("SELECT count(*)::int AS n FROM problems WHERE folder_id = $1", [req.params.id]);
  if (rows[0].n > 0) {
    return res.status(409).json({ error: "folder is not empty" });
  }
  const { rowCount } = await pool.query("DELETE FROM problem_folders WHERE id = $1 AND created_by = $2", [
    req.params.id,
    req.user.sub,
  ]);
  if (!rowCount) return res.status(404).json({ error: "folder not found" });
  res.status(204).end();
});

async function fetchProblemDetail(id, userSub) {
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.description, p.signature_hint AS "signatureHint", p.difficulty,
            p.folder_id AS "folderId", p.is_shared AS shared, (p.created_by = $2) AS mine,
            p.created_at, p.updated_at,
            (SELECT count(*)::int FROM problem_likes WHERE problem_id = p.id) AS "likesCount",
            EXISTS(SELECT 1 FROM problem_likes WHERE problem_id = p.id AND user_id = $2) AS "likedByMe"
     FROM problems p WHERE p.id = $1 AND (p.created_by = $2 OR p.is_shared = true)`,
    [id, userSub]
  );
  const problem = rows[0];
  if (!problem) return null;

  const [{ rows: starters }, { rows: solutions }, { rows: testCode }] = await Promise.all([
    pool.query("SELECT language, starter_code AS code FROM problem_starters WHERE problem_id = $1", [id]),
    pool.query("SELECT id, language, title, code FROM problem_solutions WHERE problem_id = $1", [id]),
    pool.query(
      `SELECT language, public_code AS "publicCode", hidden_code AS "hiddenCode"
       FROM problem_test_code WHERE problem_id = $1`,
      [id]
    ),
  ]);

  return { ...problem, starters, solutions, testCode };
}

router.get("/", async (req, res) => {
  const { folderId } = req.query;
  const values = [req.user.sub];
  let folderClause = "";
  if (folderId !== undefined) {
    values.push(folderId || null);
    folderClause = `AND folder_id ${folderId ? "= $2" : "IS NULL"}`;
  }
  const { rows } = await pool.query(
    `SELECT id, title, description, signature_hint AS "signatureHint", difficulty, folder_id AS "folderId",
            is_shared AS shared, (created_by = $1) AS mine, created_at, updated_at,
            (SELECT count(*)::int FROM problem_likes WHERE problem_id = problems.id) AS "likesCount",
            EXISTS(SELECT 1 FROM problem_likes WHERE problem_id = problems.id AND user_id = $1) AS "likedByMe"
     FROM problems WHERE (created_by = $1 OR is_shared = true) ${folderClause}
     ORDER BY is_shared ASC, updated_at DESC`,
    values
  );
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const problem = await fetchProblemDetail(req.params.id, req.user.sub);
  if (!problem) return res.status(404).json({ error: "problem not found" });
  res.json(problem);
});

function validateBody(body) {
  if (!body?.title?.trim()) return "title is required";
  if (body.difficulty !== undefined && (body.difficulty < 1 || body.difficulty > 5)) {
    return "difficulty must be between 1 and 5";
  }
  return null;
}

// starters/solutions/testCode are saved as one whole-object write - the
// authoring form edits everything together, so granular sub-resource
// endpoints would just be more round trips for no benefit.
async function replaceNested(client, problemId, { starters, solutions, testCode }) {
  await client.query("DELETE FROM problem_starters WHERE problem_id = $1", [problemId]);
  await client.query("DELETE FROM problem_solutions WHERE problem_id = $1", [problemId]);
  await client.query("DELETE FROM problem_test_code WHERE problem_id = $1", [problemId]);

  for (const s of starters || []) {
    await client.query(
      "INSERT INTO problem_starters (problem_id, language, starter_code) VALUES ($1, $2, $3)",
      [problemId, s.language, s.code || ""]
    );
  }
  for (const s of solutions || []) {
    await client.query(
      "INSERT INTO problem_solutions (problem_id, language, title, code) VALUES ($1, $2, $3, $4)",
      [problemId, s.language, s.title || "", s.code || ""]
    );
  }
  for (const t of testCode || []) {
    await client.query(
      `INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code)
       VALUES ($1, $2, $3, $4)`,
      [problemId, t.language, t.publicCode || "", t.hiddenCode || ""]
    );
  }
}

router.post("/", async (req, res) => {
  const error = validateBody(req.body);
  if (error) return res.status(400).json({ error });
  const { title, description, signatureHint, difficulty, folderId, shared, starters, solutions, testCode } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO problems (title, description, signature_hint, difficulty, folder_id, created_by, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [title.trim(), description || "", signatureHint || "", difficulty || 3, folderId || null, req.user.sub, Boolean(shared)]
    );
    const problemId = rows[0].id;
    await replaceNested(client, problemId, { starters, solutions, testCode });
    await client.query("COMMIT");
    res.status(201).json(await fetchProblemDetail(problemId, req.user.sub));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("create problem failed:", err);
    res.status(500).json({ error: "failed to create problem" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const error = validateBody(req.body);
  if (error) return res.status(400).json({ error });
  const { title, description, signatureHint, difficulty, folderId, shared, starters, solutions, testCode } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE problems SET title = $1, description = $2, signature_hint = $3, difficulty = $4,
              folder_id = $5, is_shared = $6, updated_at = now()
       WHERE id = $7 AND (created_by = $8 OR is_shared = true)`,
      [title.trim(), description || "", signatureHint || "", difficulty || 3, folderId || null, Boolean(shared), req.params.id, req.user.sub]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "problem not found" });
    }
    await replaceNested(client, req.params.id, { starters, solutions, testCode });
    await client.query("COMMIT");
    res.json(await fetchProblemDetail(req.params.id, req.user.sub));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("update problem failed:", err);
    res.status(500).json({ error: "failed to update problem" });
  } finally {
    client.release();
  }
});

router.patch("/:id", async (req, res) => {
  const { title, shared, folderId, difficulty } = req.body || {};
  if ([title, shared, folderId, difficulty].every((v) => v === undefined)) {
    return res.status(400).json({ error: "nothing to update" });
  }
  if (title !== undefined && !title.trim()) return res.status(400).json({ error: "title is required" });
  if (difficulty !== undefined && (difficulty < 1 || difficulty > 5)) {
    return res.status(400).json({ error: "difficulty must be between 1 and 5" });
  }

  const sets = [];
  const values = [];
  if (title !== undefined) {
    values.push(title.trim());
    sets.push(`title = $${values.length}`);
  }
  if (shared !== undefined) {
    values.push(Boolean(shared));
    sets.push(`is_shared = $${values.length}`);
  }
  if (folderId !== undefined) {
    values.push(folderId || null);
    sets.push(`folder_id = $${values.length}`);
  }
  if (difficulty !== undefined) {
    values.push(difficulty);
    sets.push(`difficulty = $${values.length}`);
  }
  values.push(req.params.id, req.user.sub);

  const { rowCount } = await pool.query(
    `UPDATE problems SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length - 1} AND (created_by = $${values.length} OR is_shared = true)`,
    values
  );
  if (!rowCount) return res.status(404).json({ error: "problem not found" });
  res.json(await fetchProblemDetail(req.params.id, req.user.sub));
});

// Any interviewer who can see a problem (owns it, or it's shared) can also
// edit or delete it - a collaborative shared problem bank, not a per-owner
// read-only share like templates. Includes problems seeded with no owner
// at all (created_by IS NULL, e.g. the "Is Palindrome" migration seed) -
// those would otherwise be permanently uneditable by anyone.
router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM problems WHERE id = $1 AND (created_by = $2 OR is_shared = true)",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "problem not found" });
  res.status(204).end();
});

// Toggle, not increment - one like per interviewer per problem.
router.post("/:id/like", async (req, res) => {
  const owns = await pool.query(
    "SELECT 1 FROM problems WHERE id = $1 AND (created_by = $2 OR is_shared = true)",
    [req.params.id, req.user.sub]
  );
  if (!owns.rows[0]) return res.status(404).json({ error: "problem not found" });

  const existing = await pool.query(
    "SELECT 1 FROM problem_likes WHERE problem_id = $1 AND user_id = $2",
    [req.params.id, req.user.sub]
  );
  if (existing.rows[0]) {
    await pool.query("DELETE FROM problem_likes WHERE problem_id = $1 AND user_id = $2", [req.params.id, req.user.sub]);
  } else {
    await pool.query("INSERT INTO problem_likes (problem_id, user_id) VALUES ($1, $2)", [req.params.id, req.user.sub]);
  }
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM problem_likes WHERE problem_id = $1", [req.params.id]);
  res.json({ liked: !existing.rows[0], likesCount: rows[0].n });
});

// Authoring-time safety net: run every reference solution (optionally
// filtered to one language) against ALL test code, public AND hidden - the
// whole point is to catch a broken test or a wrong solution before either
// ever reaches a candidate. Never exposed to candidates.
router.post("/:id/validate", async (req, res) => {
  const problem = await fetchProblemDetail(req.params.id, req.user.sub);
  if (!problem) return res.status(404).json({ error: "problem not found" });

  const { language } = req.body || {};
  const solutions = problem.solutions.filter((s) => !language || s.language === language);
  if (solutions.length === 0) {
    return res.status(400).json({ error: "no reference solutions to validate" });
  }

  const results = [];
  for (const solution of solutions) {
    const tc = problem.testCode.find((t) => t.language === solution.language);
    if (!harnessFor(solution.language)) {
      results.push({ solutionId: solution.id, language: solution.language, title: solution.title, error: `tests not supported for language: ${solution.language}` });
      continue;
    }
    if (!tc || (!tc.publicCode?.trim() && !tc.hiddenCode?.trim())) {
      results.push({ solutionId: solution.id, language: solution.language, title: solution.title, error: "no test code for this language yet" });
      continue;
    }
    try {
      const { results: caseResults } = await runProblemTests({
        language: solution.language,
        candidateCode: solution.code,
        publicTestCode: tc.publicCode,
        hiddenTestCode: tc.hiddenCode,
        mode: "submit",
      });
      const passedCount = caseResults.filter((c) => c.passed).length;
      results.push({
        solutionId: solution.id,
        language: solution.language,
        title: solution.title,
        passedCount,
        totalCount: caseResults.length,
        allPassed: passedCount === caseResults.length,
        cases: caseResults,
      });
    } catch (err) {
      results.push({ solutionId: solution.id, language: solution.language, title: solution.title, error: err.message });
    }
  }

  res.json({ results });
});
