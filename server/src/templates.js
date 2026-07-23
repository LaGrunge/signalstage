import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";

export const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, language, code, created_at FROM templates WHERE created_by = $1 ORDER BY created_at DESC",
    [req.user.sub]
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { title, language, code } = req.body || {};
  if (!title?.trim() || !language) {
    return res.status(400).json({ error: "title and language are required" });
  }
  const { rows } = await pool.query(
    "INSERT INTO templates (title, language, code, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, language, code, created_at",
    [title.trim(), language, code || "", req.user.sub]
  );
  res.status(201).json(rows[0]);
});

router.put("/:id", async (req, res) => {
  const { title, language, code } = req.body || {};
  if (!title?.trim() || !language) {
    return res.status(400).json({ error: "title and language are required" });
  }
  const { rows } = await pool.query(
    `UPDATE templates SET title = $1, language = $2, code = $3
     WHERE id = $4 AND created_by = $5
     RETURNING id, title, language, code, created_at`,
    [title.trim(), language, code || "", req.params.id, req.user.sub]
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
