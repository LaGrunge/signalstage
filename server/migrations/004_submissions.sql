CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  stdin TEXT NOT NULL DEFAULT '',
  status TEXT,
  stdout TEXT,
  stderr TEXT,
  compile_output TEXT,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_room_id_idx ON submissions(room_id, created_at DESC);
