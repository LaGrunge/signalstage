-- Who took part in a session, as user ids. room_events already records
-- join/leave, but only by display name (candidates type theirs by hand, so
-- the actor column is free text and can't be trusted as an identity) - the
-- dashboard's "only sessions I took part in" filter needs something that
-- actually points at an account.
CREATE TABLE IF NOT EXISTS room_participants (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS room_participants_user_idx ON room_participants (user_id);

-- Creators, going back over every room that exists.
INSERT INTO room_participants (room_id, user_id, first_seen, last_seen)
SELECT id, created_by, created_at, last_active_at FROM rooms
ON CONFLICT (room_id, user_id) DO NOTHING;

-- Best-effort backfill for everyone else: match past join/leave events to
-- accounts by display name. This is a one-time convenience for sessions that
-- happened before this table existed, not the mechanism going forward (see
-- GET /rooms/:id in rooms.js, which records participation from the
-- authenticated request itself).
--
-- Only names that belong to exactly one account are matched. Display names
-- are neither unique nor verified, and this deployment really does have
-- several accounts sharing one - matching those would hand a session to
-- people who were never in it.
INSERT INTO room_participants (room_id, user_id, first_seen, last_seen)
SELECT e.room_id, u.id, min(e.created_at), max(e.created_at)
FROM room_events e
JOIN users u ON u.name = e.actor
WHERE (SELECT count(*) FROM users u2 WHERE u2.name = u.name) = 1
GROUP BY e.room_id, u.id
ON CONFLICT (room_id, user_id) DO NOTHING;
