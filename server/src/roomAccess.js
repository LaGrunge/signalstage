import { pool } from "./db.js";

// Shared by /execute (server/src/judge0.js) and /rooms/:id/tests (server/src/rooms.js)
// - both need the same "does this room exist, and is this caller allowed to
// run things in it" check. The interviewer who owns a room always bypasses
// both the run_enabled and tests_enabled toggles; only non-owners are gated.
export async function getRoomAccess(roomId, userSub) {
  const { rows } = await pool.query(
    `SELECT created_by, language, run_enabled, tests_enabled, problem_id AS "problemId"
     FROM rooms WHERE id = $1 AND active = true`,
    [roomId || null]
  );
  const room = rows[0];
  if (!room) return null;
  return { room, isOwner: userSub === room.created_by };
}
