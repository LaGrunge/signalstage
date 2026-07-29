-- Session playback: keystroke-level Yjs update log + participant events +
-- an explicit "session ended" state on rooms.
--
-- Like every migration here, this file re-runs on every API boot
-- (db.js runMigrations replays all .sql files sorted) - keep every
-- statement idempotent and never put a data-destroying statement here.

-- NULL = session still open. Distinct from rooms.active: "Delete" (soft
-- delete, active=false) hides a room forever, "End session" (ended_at)
-- locks it for the candidate but keeps it on the dashboard for playback.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Append-only log of raw Yjs updates, one row per editor transaction
-- (y-monaco batches per Monaco content-change event, so a paste is one
-- row). BIGSERIAL PK is a deliberate deviation from the UUID convention:
-- this is an ordered log and a monotonic sequence IS the ordering
-- guarantee - created_at alone collides at ms resolution within a
-- buffered flush. created_at is the capture time (passed explicitly by
-- the flusher), not the flush time.
-- is_keyframe rows carry a full document snapshot (Y.encodeStateAsUpdate)
-- taken when Hocuspocus (re)loads the document. They are load-bearing for
-- replay in two ways: (1) client updates causally depend on the server-side
-- template/last_code seed, which onChange never sees (it happens inside
-- onLoadDocument), and (2) each document unload+reload starts a fresh Yjs
-- history, so blindly applying two segments' updates into one doc would
-- duplicate the text. Replay must start a fresh Y.Doc at every keyframe.
CREATE TABLE IF NOT EXISTS yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor TEXT,
  update BYTEA NOT NULL,
  is_keyframe BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS yjs_updates_room_id_idx ON yjs_updates(room_id, id);

-- Participant lifecycle markers for the playback timeline.
CREATE TABLE IF NOT EXISTS room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'join' | 'leave' | 'ended'
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_events_room_id_created_at_idx
  ON room_events(room_id, created_at DESC);
