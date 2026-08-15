-- Problem-bank folders become a real tree, addressed by a materialized path
-- ("algorithms/graphs") rather than a flat title. That is the shape the
-- planned Git-repo backing wants: one directory per path segment, so
-- import/export is a straight mapping and a rename is a prefix rewrite over
-- the subtree. Nesting is implied by the path - there is no parent column to
-- keep consistent with it.

ALTER TABLE problem_folders ADD COLUMN IF NOT EXISTS path TEXT;

-- Existing flat titles become top-level paths. Titles were never unique,
-- while paths must be, so collisions get a numeric suffix instead of failing
-- the migration (and with it every boot).
--
-- Wrapped in a column-existence check because every migration re-runs on
-- every API boot (server/src/db.js): once title has been dropped below, a
-- bare reference to it here would fail on the next start.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'problem_folders' AND column_name = 'title'
  ) THEN
    WITH ranked AS (
      SELECT id, title, row_number() OVER (PARTITION BY title ORDER BY created_at, id) AS rn
      FROM problem_folders
      WHERE path IS NULL
    )
    UPDATE problem_folders f
    SET path = CASE WHEN r.rn = 1 THEN r.title ELSE r.title || ' (' || r.rn || ')' END
    FROM ranked r
    WHERE r.id = f.id;
  END IF;
END $$;

ALTER TABLE problem_folders ALTER COLUMN path SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS problem_folders_path_key ON problem_folders (path);

-- path's last segment IS the display name; keeping title too would be a
-- second source of truth for the same string.
ALTER TABLE problem_folders DROP COLUMN IF EXISTS title;

CREATE INDEX IF NOT EXISTS problems_folder_id_idx ON problems (folder_id);
