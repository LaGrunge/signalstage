ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Bumped from Hocuspocus's onStoreDocument hook (debounced by hocuspocus
-- itself, not on every keystroke) so dashboard cards can sort/label rooms by
-- actual recent activity instead of just creation time.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();
