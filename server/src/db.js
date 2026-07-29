import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "signalstage",
  user: process.env.POSTGRES_USER || "signalstage",
  password: process.env.POSTGRES_PASSWORD,
});

async function waitForPostgres(retries = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`postgres not ready yet (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function runMigrations() {
  await waitForPostgres();
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }
}

// "Joinable" is the real semantic: sole caller is the collab server's
// onAuthenticate, and ended sessions must reject (re)connections just like
// deleted ones.
export async function roomExists(roomId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM rooms WHERE id = $1 AND active = true AND ended_at IS NULL",
    [roomId]
  );
  return rows.length > 0;
}

export async function getRoomInitialCode(roomId) {
  // Prefer the last stored snapshot over the original template: Hocuspocus
  // fires onStoreDocument right before unloading a document, so last_code is
  // current whenever the doc gets evicted (everyone disconnected, or the
  // server restarted gracefully). Without this, a reloaded document reseeds
  // from the template and the session's real code - still safe in last_code -
  // silently vanishes from the editor.
  const { rows } = await pool.query(
    "SELECT COALESCE(NULLIF(last_code, ''), initial_code) AS code FROM rooms WHERE id = $1",
    [roomId]
  );
  return rows[0]?.code || null;
}
