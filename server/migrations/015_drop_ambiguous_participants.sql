-- 014's backfill matched room_events.actor to users.name without checking
-- that the name identified a single account. This deployment has several
-- accounts sharing a display name, so a few rooms picked up "participants"
-- who were never in them - and would have seen those sessions by default.
-- 014 no longer matches ambiguous names; this cleans up what it already
-- wrote.
--
-- Every migration re-runs on every API boot, so a bare DELETE would also
-- keep wiping out genuine visits by anyone who happens to share a name.
-- Hence the label: adding the column stamps 'backfill' on exactly the rows
-- that exist right now - which on any deployment that reaches this migration
-- are precisely the ones 014's untightened backfill wrote - and the default
-- then flips to 'visit' for everything after. (On a fresh install 014's
-- backfill runs before this and inherits 'visit'; harmless, since a
-- tightened 014 can no longer produce an ambiguous row for this to clean.)
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'backfill';
ALTER TABLE room_participants ALTER COLUMN source SET DEFAULT 'visit';

-- Room creators are excluded: their participation comes from the rooms table
-- itself, not from name matching. Anyone genuinely in one of these rooms
-- gets their row back the moment they open it again, so this costs a
-- re-entry at worst, never real access.
DELETE FROM room_participants p
USING users u, rooms r
WHERE u.id = p.user_id
  AND r.id = p.room_id
  AND p.source = 'backfill'
  AND r.created_by <> p.user_id
  AND (SELECT count(*) FROM users u2 WHERE u2.name = u.name) > 1;
