import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";

export const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    // Whoever registers first on a fresh install is the admin - otherwise a
    // new deployment has an accounts screen nobody is allowed to open.
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ($1, $2, $3, NOT EXISTS (SELECT 1 FROM users))
       RETURNING id, email, name, is_admin AS "isAdmin"`,
      [email.toLowerCase().trim(), passwordHash, name]
    );
    const user = rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "an account with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { rows } = await pool.query(
    `SELECT id, email, name, password_hash, is_admin AS "isAdmin" FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid email or password" });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
});

// Who am I *right now* - the stored session object is written at login and
// would otherwise keep claiming yesterday's admin flag for up to a token's
// lifetime, hiding (or wrongly showing) the admin-only tabs.
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, name, is_admin AS "isAdmin" FROM users WHERE id = $1`,
    [req.user.sub]
  );
  if (!rows[0]) return res.status(401).json({ error: "account no longer exists" });
  res.json(rows[0]);
});

// Deliberately not the standard `Authorization` header: nginx sits in front
// of this app doing its own HTTP Basic Auth gate on the whole site (see
// README "Security and production checklist"), which also lives in
// `Authorization` - the two would stomp on each other, since a client can
// only send one Authorization value per request.
const TOKEN_HEADER = "x-signalstage-token";

// req.user.isAdmin is read from the database rather than carried in the JWT:
// tokens live 12h, and an admin flag that only takes effect after the next
// login is the kind of thing nobody remembers when they need it.
export async function requireAuth(req, res, next) {
  const token = req.headers[TOKEN_HEADER];
  if (!token) return res.status(401).json({ error: "missing token" });

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }

  try {
    const { rows } = await pool.query("SELECT is_admin FROM users WHERE id = $1", [claims.sub]);
    if (!rows[0]) return res.status(401).json({ error: "account no longer exists" });
    req.user = { ...claims, isAdmin: rows[0].is_admin };
    next();
  } catch (err) {
    console.error("auth lookup failed:", err.message);
    res.status(500).json({ error: "internal error" });
  }
}

// Admin-only routes (accounts, instance settings). Everything else that an
// admin may do to someone else's resource is expressed inline as
// "owner or admin" in the query, so the same handler serves both.
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "admin only" });
  next();
}

// For routes candidates hit anonymously (e.g. /execute) but where an
// interviewer identity, if present, still needs to be known - unlike
// requireAuth, a missing or invalid token is not an error here.
export function optionalAuth(req, _res, next) {
  const token = req.headers[TOKEN_HEADER];
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // ignore - treated as anonymous
    }
  }
  next();
}
