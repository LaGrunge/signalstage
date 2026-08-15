-- Instance-wide policy, not per-interviewer preference: how a new session
-- starts. One row, enforced by the primary key check - there is exactly one
-- installation and exactly one answer.
CREATE TABLE IF NOT EXISTS app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_run_enabled BOOLEAN NOT NULL DEFAULT true,
  default_copy_paste_blocked BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
