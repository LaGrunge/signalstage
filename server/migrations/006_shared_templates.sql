-- Templates gain a personal/shared split: is_shared=true makes a template
-- visible to every interviewer, not just its creator, for a common task
-- bank alongside each interviewer's own private templates. created_by
-- becomes nullable so seeded, no-owner "system" templates (007) can exist -
-- ownership checks elsewhere (created_by = req.user.sub) already make those
-- untouchable via the API since NULL never equals a real user id.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE templates ALTER COLUMN created_by DROP NOT NULL;
CREATE INDEX IF NOT EXISTS templates_is_shared_idx ON templates(is_shared) WHERE is_shared;
