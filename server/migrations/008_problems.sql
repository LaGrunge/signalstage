-- Structured interview tasks: title + markdown description + per-language
-- starter code + reference solutions (authoring-time test validation only,
-- never run for candidates) + test cases (public examples + hidden cases).
-- Additive alongside `templates` - templates stay the lightweight "just a
-- blob of starter code" flow; a room can reference either a template or a
-- problem, not both at once.
CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  function_name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '[]',
  return_type TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS problems_created_by_idx ON problems(created_by);

CREATE TABLE IF NOT EXISTS problem_starters (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  starter_code TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (problem_id, language)
);

-- Never sent to candidates - purely so an interviewer authoring a problem
-- can validate their test cases against a known-good (and optionally a
-- known-bad, for a sanity check) implementation before ever attaching the
-- problem to a live room.
CREATE TABLE IF NOT EXISTS problem_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS problem_solutions_problem_id_idx ON problem_solutions(problem_id);

CREATE TABLE IF NOT EXISTS problem_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '[]',
  expected JSONB NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS problem_tests_problem_id_idx ON problem_tests(problem_id, position);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS problem_id UUID REFERENCES problems(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS tests_enabled BOOLEAN NOT NULL DEFAULT true;

-- Mirrors `submissions` but for test runs specifically - "run" (visible
-- cases only, fast feedback) vs "submit" (all cases, graded) per test_runs.mode.
CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  mode TEXT NOT NULL,
  results JSONB NOT NULL,
  passed_count INT NOT NULL,
  total_count INT NOT NULL,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_runs_room_id_idx ON test_runs(room_id, created_at DESC);
