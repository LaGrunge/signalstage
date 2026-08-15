-- Per-session switch, alongside run_enabled/tests_enabled: when on, the
-- candidate side of the room refuses copy, cut and paste. Best effort by
-- nature (it is the browser doing the refusing), so it raises the cost of
-- pasting in a prepared solution rather than making it impossible.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS copy_paste_blocked BOOLEAN NOT NULL DEFAULT false;
