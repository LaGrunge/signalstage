import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import { runTests } from "./testRunner.js";
import { harnessFor } from "./testHarness/index.js";

export const router = Router();

router.use(requireAuth);

async function fetchProblemDetail(id, userSub) {
  const { rows } = await pool.query(
    `SELECT id, title, description, function_name AS "functionName", params, return_type AS "returnType",
            is_shared AS shared, (created_by = $2) AS mine, created_at, updated_at
     FROM problems WHERE id = $1 AND (created_by = $2 OR is_shared = true)`,
    [id, userSub]
  );
  const problem = rows[0];
  if (!problem) return null;

  const [{ rows: starters }, { rows: solutions }, { rows: tests }] = await Promise.all([
    pool.query("SELECT language, starter_code AS code FROM problem_starters WHERE problem_id = $1", [id]),
    pool.query("SELECT id, language, title, code FROM problem_solutions WHERE problem_id = $1", [id]),
    pool.query(
      `SELECT id, name, args, expected, is_hidden AS "isHidden", position
       FROM problem_tests WHERE problem_id = $1 ORDER BY position ASC`,
      [id]
    ),
  ]);

  return { ...problem, starters, solutions, tests };
}

// Personal problems (mine) plus every shared problem, same ownership model
// as templates.js. List view omits starters/solutions/tests - those are
// only needed once you open a specific problem to edit or attach it.
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, description, function_name AS "functionName", params, return_type AS "returnType",
            is_shared AS shared, (created_by = $1) AS mine, created_at, updated_at
     FROM problems WHERE created_by = $1 OR is_shared = true
     ORDER BY is_shared ASC, updated_at DESC`,
    [req.user.sub]
  );
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const problem = await fetchProblemDetail(req.params.id, req.user.sub);
  if (!problem) return res.status(404).json({ error: "problem not found" });
  res.json(problem);
});

function validateBody(body) {
  const { title, functionName, returnType, params } = body || {};
  if (!title?.trim()) return "title is required";
  if (!functionName?.trim()) return "functionName is required";
  if (!returnType) return "returnType is required";
  if (!Array.isArray(params)) return "params must be an array";
  return null;
}

// Nested starters/solutions/tests are saved as one whole-object write - a
// problem's authoring form edits everything together, so granular
// sub-resource endpoints would just be more round trips for no benefit.
async function replaceNested(client, problemId, { starters, solutions, tests }) {
  await client.query("DELETE FROM problem_starters WHERE problem_id = $1", [problemId]);
  await client.query("DELETE FROM problem_solutions WHERE problem_id = $1", [problemId]);
  await client.query("DELETE FROM problem_tests WHERE problem_id = $1", [problemId]);

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
  let position = 0;
  for (const t of tests || []) {
    await client.query(
      `INSERT INTO problem_tests (problem_id, name, args, expected, is_hidden, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [problemId, t.name, JSON.stringify(t.args ?? []), JSON.stringify(t.expected), Boolean(t.isHidden), position++]
    );
  }
}

router.post("/", async (req, res) => {
  const error = validateBody(req.body);
  if (error) return res.status(400).json({ error });
  const { title, description, functionName, returnType, params, shared, starters, solutions, tests } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO problems (title, description, function_name, params, return_type, created_by, is_shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [title.trim(), description || "", functionName.trim(), JSON.stringify(params), returnType, req.user.sub, Boolean(shared)]
    );
    const problemId = rows[0].id;
    await replaceNested(client, problemId, { starters, solutions, tests });
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
  const { title, description, functionName, returnType, params, shared, starters, solutions, tests } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE problems SET title = $1, description = $2, function_name = $3, params = $4, return_type = $5,
              is_shared = $6, updated_at = now()
       WHERE id = $7 AND created_by = $8`,
      [title.trim(), description || "", functionName.trim(), JSON.stringify(params), returnType, Boolean(shared), req.params.id, req.user.sub]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "problem not found" });
    }
    await replaceNested(client, req.params.id, { starters, solutions, tests });
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
  const { title, shared } = req.body || {};
  if (title === undefined && shared === undefined) {
    return res.status(400).json({ error: "nothing to update" });
  }
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "title is required" });
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
  values.push(req.params.id, req.user.sub);

  const { rowCount } = await pool.query(
    `UPDATE problems SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length - 1} AND created_by = $${values.length}`,
    values
  );
  if (!rowCount) return res.status(404).json({ error: "problem not found" });
  res.json(await fetchProblemDetail(req.params.id, req.user.sub));
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM problems WHERE id = $1 AND created_by = $2",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "problem not found" });
  res.status(204).end();
});

// Authoring-time safety net: run every reference solution (optionally
// filtered to one language) against ALL test cases, hidden included - the
// whole point is to catch a wrong expected value or an ambiguous problem
// before it ever reaches a candidate. Never exposed to candidates.
router.post("/:id/validate", async (req, res) => {
  const problem = await fetchProblemDetail(req.params.id, req.user.sub);
  if (!problem) return res.status(404).json({ error: "problem not found" });

  const { language } = req.body || {};
  const solutions = problem.solutions.filter((s) => !language || s.language === language);
  if (solutions.length === 0) {
    return res.status(400).json({ error: "no reference solutions to validate" });
  }
  if (problem.tests.length === 0) {
    return res.status(400).json({ error: "problem has no test cases yet" });
  }

  const results = [];
  for (const solution of solutions) {
    if (!harnessFor(solution.language)) {
      results.push({ solutionId: solution.id, language: solution.language, title: solution.title, error: `tests not supported for language: ${solution.language}` });
      continue;
    }
    try {
      const { results: caseResults } = await runTests({
        language: solution.language,
        candidateCode: solution.code,
        functionName: problem.functionName,
        returnType: problem.returnType,
        params: problem.params,
        testCases: problem.tests,
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
