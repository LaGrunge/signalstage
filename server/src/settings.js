import { Router } from "express";
import { pool } from "./db.js";
import { requireAuth, requireAdmin } from "./auth.js";

export const router = Router();

// Readable by any interviewer (the room-creation path and the settings tab
// both need it), writable only by an admin - this is instance policy, not a
// personal preference.
export async function getSettings() {
  const { rows } = await pool.query(
    `SELECT default_run_enabled AS "defaultRunEnabled",
            default_copy_paste_blocked AS "defaultCopyPasteBlocked"
     FROM app_settings WHERE id = 1`
  );
  return rows[0] ?? { defaultRunEnabled: true, defaultCopyPasteBlocked: false };
}

router.get("/", requireAuth, async (_req, res) => {
  res.json(await getSettings());
});

router.patch("/", requireAuth, requireAdmin, async (req, res) => {
  const { defaultRunEnabled, defaultCopyPasteBlocked } = req.body || {};
  if (defaultRunEnabled === undefined && defaultCopyPasteBlocked === undefined) {
    return res.status(400).json({ error: "nothing to update" });
  }

  const sets = [];
  const values = [];
  if (defaultRunEnabled !== undefined) {
    values.push(Boolean(defaultRunEnabled));
    sets.push(`default_run_enabled = $${values.length}`);
  }
  if (defaultCopyPasteBlocked !== undefined) {
    values.push(Boolean(defaultCopyPasteBlocked));
    sets.push(`default_copy_paste_blocked = $${values.length}`);
  }

  const { rows } = await pool.query(
    `UPDATE app_settings SET ${sets.join(", ")}, updated_at = now() WHERE id = 1
     RETURNING default_run_enabled AS "defaultRunEnabled",
               default_copy_paste_blocked AS "defaultCopyPasteBlocked"`,
    values
  );
  res.json(rows[0]);
});
