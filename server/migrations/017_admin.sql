-- Admin flag. An admin may act on every resource as if it were their own
-- (sessions, shared templates, problems) and manages accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Bootstrap, once, only while nobody is an admin yet. Going forward the
-- first account to register becomes the admin (see auth.js), but this
-- deployment predates the flag and its earliest row is a smoke-test account,
-- so the real operator's address is named here rather than inherited by
-- whichever automated signup happened to run first. On a fresh database this
-- matches nothing and the register path does the work instead.
UPDATE users SET is_admin = true
WHERE email = 'aa@aa' AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin);
