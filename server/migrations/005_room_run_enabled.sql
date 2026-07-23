-- Server-side source of truth for the "Disable candidate run" toggle. The
-- toggle used to live only in the Yjs config map, so /execute never actually
-- enforced it - a candidate could still POST directly to /api/execute and
-- bypass the UI-only gate. Interviewers (created_by) always bypass this.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS run_enabled BOOLEAN NOT NULL DEFAULT true;
