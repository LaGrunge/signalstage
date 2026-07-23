import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";

export const router = Router();

router.use(requireAuth);

// Personal templates (mine, never shared) plus every shared template in the
// common bank, including seeded no-owner ones and other interviewers' - "mine"
// tells the frontend which cards it may rename/delete/unshare.
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, language, code, created_at, updated_at,
            is_shared AS shared, (created_by = $1) AS mine
     FROM templates WHERE created_by = $1 OR is_shared = true
     ORDER BY is_shared ASC, updated_at DESC`,
    [req.user.sub]
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { title, language, code, shared } = req.body || {};
  if (!title?.trim() || !language) {
    return res.status(400).json({ error: "title and language are required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO templates (title, language, code, created_by, is_shared)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, language, code, created_at, updated_at, is_shared AS shared, true AS mine`,
    [title.trim(), language, code || "", req.user.sub, Boolean(shared)]
  );
  res.status(201).json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const { title, language, code, shared } = req.body || {};
  if (!title?.trim() || !language) {
    return res.status(400).json({ error: "title and language are required" });
  }
  const { rows } = await pool.query(
    `UPDATE templates SET title = $1, language = $2, code = $3, is_shared = $4, updated_at = now()
     WHERE id = $5 AND created_by = $6
     RETURNING id, title, language, code, created_at, updated_at, is_shared AS shared, true AS mine`,
    [title.trim(), language, code || "", Boolean(shared), req.params.id, req.user.sub]
  );
  if (!rows[0]) return res.status(404).json({ error: "template not found" });
  res.json(rows[0]);
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

  const { rows } = await pool.query(
    `UPDATE templates SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length - 1} AND created_by = $${values.length}
     RETURNING id, title, language, code, created_at, updated_at, is_shared AS shared, true AS mine`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: "template not found" });
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM templates WHERE id = $1 AND created_by = $2",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "template not found" });
  res.status(204).end();
});
