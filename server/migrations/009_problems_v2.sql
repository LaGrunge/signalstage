-- Problem bank v2: folders, difficulty, likes, and tests-as-real-code
-- (replacing the JSON args/expected/param-type model from 008 with actual
-- test source code per language - see CLAUDE.md "Interview problems v2").

CREATE TABLE IF NOT EXISTS problem_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE problems ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES problem_folders(id) ON DELETE SET NULL;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS difficulty SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5);

-- The function-signature type system (function_name/params/return_type)
-- only made sense when tests were JSON args/expected driven by that
-- signature. Tests are now real per-language test code that calls
-- whatever the candidate wrote however it likes - keep only a free-text
-- hint shown to the candidate, not a machine-parsed signature.
ALTER TABLE problems ADD COLUMN IF NOT EXISTS signature_hint TEXT NOT NULL DEFAULT '';
ALTER TABLE problems DROP COLUMN IF EXISTS function_name;
ALTER TABLE problems DROP COLUMN IF EXISTS params;
ALTER TABLE problems DROP COLUMN IF EXISTS return_type;

CREATE TABLE IF NOT EXISTS problem_likes (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_id, user_id)
);

-- Replaces 008's problem_tests (one row per JSON test case) - each test is
-- now a blob of real test-framework code per language: public_code (shown
-- to the candidate as runnable examples) and hidden_code (never sent to
-- the browser, only executed server-side at Submit). No real data existed
-- in the old shape yet (008 shipped minutes before this migration), so a
-- clean drop+recreate is safe - this only ever fires once, since
-- `DROP TABLE IF EXISTS` is a no-op on every subsequent boot once it's gone.
DROP TABLE IF EXISTS problem_tests;

CREATE TABLE IF NOT EXISTS problem_test_code (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  public_code TEXT NOT NULL DEFAULT '',
  hidden_code TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (problem_id, language)
);
