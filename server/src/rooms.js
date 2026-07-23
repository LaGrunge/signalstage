import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth } from "./auth.js";
import { LANGUAGES } from "./judge0.js";
import { getLiveDocument } from "./collabServer.js";

export const router = Router();

const LANGUAGE_KEYS = new Set(LANGUAGES.map((l) => l.key));
const PREVIEW_LENGTH = 400;

function roomPreview(room) {
  const live = getLiveDocument(room.id);
  const code = live ? live.getText("code").toString() : room.last_code ?? room.initial_code ?? "";
  return code.slice(0, PREVIEW_LENGTH);
}

router.post("/", requireAuth, async (req, res) => {
  const { title, language, templateId } = req.body || {};
  let lang = LANGUAGE_KEYS.has(language) ? language : "python";
  let initialCode = null;
  let defaultTitle = "Interview session";

  if (templateId) {
    const { rows } = await pool.query(
      "SELECT title, language, code FROM templates WHERE id = $1 AND created_by = $2",
      [templateId, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "template not found" });
    lang = rows[0].language;
    initialCode = rows[0].code;
    defaultTitle = rows[0].title;
  }

  const { rows } = await pool.query(
    "INSERT INTO rooms (title, language, created_by, initial_code) VALUES ($1, $2, $3, $4) RETURNING id, title, language, created_at",
    [title?.trim() || defaultTitle, lang, req.user.sub, initialCode]
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
      return { ...rest, preview };
    })
  );
});

// Intentionally public: the room id itself (a UUIDv4) is the shared secret in
// the interview link, matching how most self-hosted "join by link" interview
// tools work. Candidates never need an account.
router.get("/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, language, active FROM rooms WHERE id = $1",
    [req.params.id]
  );
  if (!rows[0] || !rows[0].active) return res.status(404).json({ error: "room not found" });
  res.json(rows[0]);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    "UPDATE rooms SET active = false WHERE id = $1 AND created_by = $2",
    [req.params.id, req.user.sub]
  );
  if (!rowCount) return res.status(404).json({ error: "room not found" });
  res.status(204).end();
});
