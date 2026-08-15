import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { requireAuth, requireAdmin } from "./auth.js";

// Account management, admin-only end to end. Interviewers who are not admins
// have no business listing colleagues' addresses, so even the read is gated.
export const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    // Deleting an account cascades to everything it created (rooms and their
    // playback, templates, problems, folders - see the FKs on users.id), so
    // the UI has to be able to say what exactly is about to go, not just
    // "sessions".
    `SELECT u.id, u.email, u.name, u.is_admin AS "isAdmin", u.created_at,
            (SELECT count(*)::int FROM rooms r WHERE r.created_by = u.id AND r.active) AS "sessionCount",
            (SELECT count(*)::int FROM templates t WHERE t.created_by = u.id) AS "templateCount",
            (SELECT count(*)::int FROM problems p WHERE p.created_by = u.id) AS "problemCount",
            (SELECT count(*)::int FROM problem_folders f WHERE f.created_by = u.id) AS "folderCount"
     FROM users u ORDER BY u.created_at ASC`
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { email, password, name, isAdmin } = req.body || {};
  if (!email?.trim() || !password || !name?.trim()) {
    return res.status(400).json({ error: "email, password and name are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_admin) VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, is_admin AS "isAdmin", created_at,
                 0 AS "sessionCount", 0 AS "templateCount", 0 AS "problemCount", 0 AS "folderCount"`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), Boolean(isAdmin)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "an account with this email already exists" });
    }
    throw err;
  }
});

// Only the admin flag is editable here - names and passwords belong to the
// person, and a "reset someone's password" flow needs more thought than a
// checkbox row.
router.patch("/:id", async (req, res) => {
  const { isAdmin } = req.body || {};
  if (isAdmin === undefined) return res.status(400).json({ error: "nothing to update" });

  // Never let the last admin demote themselves: the accounts screen and the
  // instance settings would become unreachable for everyone, with no way back
  // short of a psql session on the box.
  if (!isAdmin && (await isLastAdmin(req.params.id))) {
    return res.status(409).json({ error: "this is the only admin left" });
  }

  const { rows } = await pool.query(
    `UPDATE users SET is_admin = $1 WHERE id = $2
     RETURNING id, email, name, is_admin AS "isAdmin", created_at`,
    [Boolean(isAdmin), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "user not found" });
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(409).json({ error: "you cannot delete your own account" });
  }
  if (await isLastAdmin(req.params.id)) {
    return res.status(409).json({ error: "this is the only admin left" });
  }
  // Everything this account owns goes with it - rooms (and their playback),
  // templates, problems all cascade from users.id. The UI says so before
  // asking for confirmation.
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "user not found" });
  res.status(204).end();
});

async function isLastAdmin(id) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM users WHERE is_admin) = 1 AS last
     FROM users WHERE id = $1 AND is_admin`,
    [id]
  );
  return Boolean(rows[0]?.last);
}
