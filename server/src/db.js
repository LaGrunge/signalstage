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

// Migrations used to re-run on every API boot, which is why they are all
// written to be idempotent. That was fine for schema changes and wrong for
// seeds: "idempotent" only ever meant "does not fail twice", and it could not
// mean "leaves deliberately deleted rows deleted". Editing a seeded problem
// deletes and reinserts its reference solutions with fresh ids, so the next
// restart put the seed's own fixed-id rows back *alongside* the edited ones -
// the shipped example problem had collected three identical copies of every
// solution that way. Deleting a seeded problem outright had it reappear on
// the next restart, too.
//
// So a file now runs once and is recorded. The idempotency in the existing
// files is still welcome (this table is created after 20 of them shipped, and
// they all run one last time on the boot that introduces it), but it is no
// longer what correctness rests on. A mistake in a released migration needs a
// new file - editing the old one no longer reaches anyone who has run it.
export async function runMigrations() {
  await waitForPostgres();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await pool.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    // node-postgres sends a multi-statement string through the simple query
    // protocol, which wraps it in one implicit transaction - a file that
    // fails halfway leaves nothing behind and stays unrecorded.
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    console.log(`applied migration ${file}`);
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

export async function getRoomDocState(roomId) {
  // state is the binary Yjs snapshot written by onStoreDocument - the
  // preferred restore path, because applying it reproduces the *same* Yjs
  // history and reconnecting clients that kept their local Y.Doc merge
  // cleanly. code is the text fallback for rooms that predate ydoc_state
  // (or have never stored yet): last stored snapshot over the original
  // template, since Hocuspocus fires onStoreDocument right before unloading
  // a document, so last_code is current whenever the doc gets evicted.
  const { rows } = await pool.query(
    "SELECT ydoc_state AS state, COALESCE(NULLIF(last_code, ''), initial_code) AS code FROM rooms WHERE id = $1",
    [roomId]
  );
  return { state: rows[0]?.state || null, code: rows[0]?.code || null };
}
