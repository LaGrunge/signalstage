CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS templates_created_by_idx ON templates(created_by);

-- Snapshotted at room-creation time from the chosen template (if any), not a
-- live reference - editing a template later must not retroactively change
-- rooms that already started from it.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS initial_code TEXT;
