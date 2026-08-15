-- Clean up after the "every migration re-runs on every boot" era (fixed in
-- server/src/db.js's runMigrations, which now records what it has applied).
--
-- Editing a seeded problem through the authoring form deletes and reinserts
-- its reference solutions with fresh ids (problems.js's replaceNested), so the
-- next API restart re-ran 010's seed and put its own fixed-id rows back next
-- to the edited ones. Two edits, three identical copies of every solution -
-- which is exactly what the shipped "Is Palindrome" problem had.
--
-- Only exact duplicates go: same problem, same language, same title, same
-- code. Two genuinely different solutions for one language are a feature
-- (that is why the table has a title column at all) and are left alone.
DELETE FROM problem_solutions
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (
             PARTITION BY problem_id, language, title, code ORDER BY id
           ) AS rn
    FROM problem_solutions
  ) ranked
  WHERE rn > 1
);
