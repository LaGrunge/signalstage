-- Archiving takes a finished session off the main list without deleting it.
-- Distinct from both existing states: ended_at locks the room, active=false
-- hides it forever, archived_at just moves it to its own tab, where it can no
-- longer be renamed and only an admin may delete it.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS rooms_archived_idx ON rooms (archived_at);
