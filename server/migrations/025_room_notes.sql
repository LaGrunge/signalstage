-- Interviewer notes: one markdown document per room, written during the
-- session and read back after it.
--
-- On rooms rather than in a table of its own: there is exactly one notes
-- document per room, and every page that shows notes (the room, the playback
-- page) already has the room row in hand.
--
-- Deliberately NOT in the room's Yjs document, which is where every other
-- piece of shared session state lives: that document is replicated to the
-- candidate's browser in full, so anything in it is readable from devtools.
-- Notes go over an authenticated REST endpoint instead and never reach a
-- candidate at all.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
