import { asyncRouter } from "./asyncRouter.js";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import { runProblemTests } from "./testRunner.js";
import { harnessFor } from "./testHarness/index.js";

export const router = asyncRouter();

router.use(requireAuth);

// --- Folders: a tree addressed by a materialized path ("algorithms/graphs"),
// shared across every interviewer like the problems inside them. Nesting is
// implied by the path, so a rename/move is a prefix rewrite over the subtree
// and the whole thing maps 1:1 onto directories in the Git repo this bank is
// headed for. Deleting only succeeds if the folder is actually empty (no
// problems, no subfolders) - the same "ask, don't cascade" rule real folder
// UIs use. ---

const kMaxSegment = 64;
const kMaxDepth = 8;

// Folder paths end up as directory names in a Git repo, so they are validated
// like ones: no empty or dot segments, no separators or control characters
// inside a segment, bounded depth.
function normalizePath(raw) {
  if (typeof raw !== "string") return { error: "path is required" };
  const segments = raw.split("/").map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length === 0) return { error: "path is required" };
  if (segments.length > kMaxDepth) return { error: `path is deeper than ${kMaxDepth} levels` };
  for (const segment of segments) {
    if (segment === "." || segment === "..") return { error: `"${segment}" is not a valid folder name` };
    if (segment.length > kMaxSegment) return { error: `folder names are limited to ${kMaxSegment} characters` };
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(segment)) return { error: "folder names cannot contain control characters" };
  }
  return { path: segments.join("/") };
}

// Every ancestor exists as its own row (mkdir -p), so listing the tree never
// has to invent folders that only exist as a prefix of a deeper one.
async function ensureAncestors(client, path, userSub) {
  const segments = path.split("/");
  for (let i = 1; i < segments.length; i++) {
    await client.query(
      "INSERT INTO problem_folders (path, created_by) VALUES ($1, $2) ON CONFLICT (path) DO NOTHING",
      [segments.slice(0, i).join("/"), userSub]
    );
  }
}

router.get("/folders", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.id, f.path, f.created_at, (f.created_by = $1) AS mine, count(p.id)::int AS "problemCount"
     FROM problem_folders f LEFT JOIN problems p ON p.folder_id = f.id
     GROUP BY f.id ORDER BY f.path ASC`,
    [req.user.sub]
  );
  res.json(rows);
});

router.post("/folders", async (req, res) => {
  const { path, error } = normalizePath(req.body?.path ?? req.body?.title);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureAncestors(client, path, req.user.sub);
    const { rows } = await client.query(
      `INSERT INTO problem_folders (path, created_by) VALUES ($1, $2)
       ON CONFLICT (path) DO NOTHING
       RETURNING id, path, created_at, true AS mine, 0 AS "problemCount"`,
      [path, req.user.sub]
    );
    await client.query("COMMIT");
    if (!rows[0]) return res.status(409).json({ error: "a folder with that path already exists" });
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// Rename and move are the same operation on a materialized path: rewrite this
// row's path and the prefix of every descendant. Open to any interviewer, like
// editing a shared problem - only deletion is owner-only.
router.patch("/folders/:id", async (req, res) => {
  const { path: nextPath, error } = normalizePath(req.body?.path);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT path FROM problem_folders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "folder not found" });
    }
    const prevPath = current.rows[0].path;
    if (nextPath === prevPath) {
      await client.query("ROLLBACK");
      return res.json({ id: req.params.id, path: prevPath });
    }
    // Moving a folder into its own subtree would detach it from the root and
    // make the prefix rewrite below chase its own tail.
    if (nextPath.startsWith(prevPath + "/")) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "cannot move a folder into itself" });
    }
    const taken = await client.query("SELECT 1 FROM problem_folders WHERE path = $1", [nextPath]);
    if (taken.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "a folder with that path already exists" });
    }

    await ensureAncestors(client, nextPath, req.user.sub);
    await client.query("UPDATE problem_folders SET path = $1 WHERE id = $2", [nextPath, req.params.id]);
    await client.query(
      "UPDATE problem_folders SET path = $1 || substring(path from $3) WHERE path LIKE $2",
      [nextPath, prevPath + "/%", prevPath.length + 1]
    );
    await client.query("COMMIT");
    res.json({ id: req.params.id, path: nextPath });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.delete("/folders/:id", async (req, res) => {
  const folder = await pool.query(
    "SELECT path FROM problem_folders WHERE id = $1 AND (created_by = $2 OR $3)",
    [req.params.id, req.user.sub, req.user.isAdmin]
  );
  if (!folder.rows[0]) return res.status(404).json({ error: "folder not found" });

  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM problems WHERE folder_id = $1)
          + (SELECT count(*) FROM problem_folders WHERE path LIKE $2) AS n`,
    [req.params.id, folder.rows[0].path + "/%"]
  );
  if (Number(rows[0].n) > 0) {
    return res.status(409).json({ error: "folder is not empty" });
  }
  const { rowCount } = await pool.query(
    "DELETE FROM problem_folders WHERE id = $1 AND (created_by = $2 OR $3)",
    [req.params.id, req.user.sub, req.user.isAdmin]
  );
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
  const { folderId, liked } = req.query;
  const values = [req.user.sub];
  let folderClause = "";
  if (folderId !== undefined) {
    values.push(folderId || null);
    folderClause = `AND folder_id ${folderId ? "= $2" : "IS NULL"}`;
  }
  // The dashboard's quick-start tab shows only what this interviewer liked -
  // a shortlist for starting a session, not the bank's full contents (that's
  // what the Problem bank page and its folder tree are for).
  const likedClause = liked === "1" || liked === "true"
    ? "AND EXISTS(SELECT 1 FROM problem_likes WHERE problem_id = problems.id AND user_id = $1)"
    : "";
  const { rows } = await pool.query(
    `SELECT id, title, description, signature_hint AS "signatureHint", difficulty, folder_id AS "folderId",
            is_shared AS shared, (created_by = $1) AS mine, created_at, updated_at,
            (SELECT count(*)::int FROM problem_likes WHERE problem_id = problems.id) AS "likesCount",
            EXISTS(SELECT 1 FROM problem_likes WHERE problem_id = problems.id AND user_id = $1) AS "likedByMe"
     FROM problems WHERE (created_by = $1 OR is_shared = true) ${folderClause} ${likedClause}
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

// Any interviewer who can see a problem (owns it, or it's shared) can edit
// its content - a collaborative shared problem bank, not a per-owner
// read-only share like templates. But *unsharing* (flipping is_shared to
// false, which hides it from everyone except its creator - including
// whoever just did it) and deleting outright are creator-only: letting any
// authenticated interviewer silently hide or permanently destroy something
// the whole team relies on is a real griefing vector, not just "fix a
// typo together". Problems seeded with no owner at all (created_by IS
// NULL, e.g. the "Is Palindrome" migration seed) can't be unshared/deleted
// by anyone via the API as a consequence - by design, same as templates'
// seeded assets.
// An admin counts as the owner throughout - the whole point of the flag is
// that nothing in the instance is out of reach of the person running it.
async function getAccess(id, userSub, isAdmin = false) {
  const { rows } = await pool.query("SELECT created_by, is_shared FROM problems WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return null;
  const isOwner = row.created_by === userSub || Boolean(isAdmin);
  if (!isOwner && !row.is_shared) return null;
  return { isOwner, isShared: row.is_shared };
}

router.put("/:id", async (req, res) => {
  const error = validateBody(req.body);
  if (error) return res.status(400).json({ error });
  const { title, description, signatureHint, difficulty, folderId, shared, starters, solutions, testCode } = req.body;

  const access = await getAccess(req.params.id, req.user.sub, req.user.isAdmin);
  if (!access) return res.status(404).json({ error: "problem not found" });
  if (!access.isOwner && access.isShared && !Boolean(shared)) {
    return res.status(403).json({ error: "only the problem's owner can unshare it" });
  }
  const nextShared = access.isOwner ? Boolean(shared) : access.isShared;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE problems SET title = $1, description = $2, signature_hint = $3, difficulty = $4,
              folder_id = $5, is_shared = $6, updated_at = now()
       WHERE id = $7`,
      [title.trim(), description || "", signatureHint || "", difficulty || 3, folderId || null, nextShared, req.params.id]
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

  const access = await getAccess(req.params.id, req.user.sub, req.user.isAdmin);
  if (!access) return res.status(404).json({ error: "problem not found" });
  if (shared !== undefined && !access.isOwner) {
    return res.status(403).json({ error: "only the problem's owner can change sharing" });
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
  values.push(req.params.id);

  const { rowCount } = await pool.query(
    `UPDATE problems SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length}`,
    values
  );
  if (!rowCount) return res.status(404).json({ error: "problem not found" });
  res.json(await fetchProblemDetail(req.params.id, req.user.sub));
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM problems WHERE id = $1 AND (created_by = $2 OR $3)",
    [req.params.id, req.user.sub, req.user.isAdmin]
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
