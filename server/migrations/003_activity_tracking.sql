ALTER TABLE templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Bumped from Hocuspocus's onStoreDocument hook (debounced by hocuspocus
-- itself, not on every keystroke) so dashboard cards can sort/label rooms by
-- actual recent activity instead of just creation time.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Snapshot of the Yjs document's text, refreshed on the same onStoreDocument
-- debounce as last_active_at above. Hocuspocus unloads a document from
-- memory once its last connection disconnects (no persistence extension is
-- configured), so relying on the live in-memory doc alone means a room's
-- dashboard preview goes blank right after the interview ends - exactly when
-- an interviewer is most likely to check it.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_code TEXT;
