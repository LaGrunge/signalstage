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

export async function roomExists(roomId) {
  const { rows } = await pool.query("SELECT 1 FROM rooms WHERE id = $1 AND active = true", [roomId]);
  return rows.length > 0;
}

export async function getRoomInitialCode(roomId) {
  const { rows } = await pool.query("SELECT initial_code FROM rooms WHERE id = $1", [roomId]);
  return rows[0]?.initial_code || null;
}
