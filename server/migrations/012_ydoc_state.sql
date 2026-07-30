-- Full Yjs document state (Y.encodeStateAsUpdate), refreshed on every
-- onStoreDocument. Restoring it in onLoadDocument preserves the Yjs history
-- across document unload/reload cycles, so a browser tab that kept its local
-- Y.Doc across a disconnect merges cleanly on reconnect instead of
-- duplicating the text against a freshly reseeded history.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ydoc_state BYTEA;
