-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v9 -> v10 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query).
--
-- Nothing is dropped, renamed or given a new signature. This
-- migration ADDS one read-only function and touches no table.
--
-- Why: "Your Splitspends on this device" lived only in the
-- browser's own storage. On iPhone the Home Screen app's storage
-- is walled off from Safari's, so a group joined in one never
-- showed in the other. Every group a person actually uses is
-- joined (the group page sends an unrecognised device to Join),
-- and joining writes a participant_devices row — so the server
-- already knows the list. This function hands it back.
--
--   list_device_trips_v10(p_device_ids TEXT[])
--     -> [{ id, name, participant_id, joined_at }], newest first
--
-- Accepts several ids because the Home Screen app may be linked
-- to Safari's device as well as having its own. At most 8 ids are
-- read, ids shorter than 16 characters are ignored (real ones are
-- 36-character random UUIDs), and at most 200 groups come back.
--
-- Security: same model as the rest of the app. A device id is as
-- unguessable as a group link and is never exposed by any RPC, so
-- knowing one already means being that device.
--
-- The v9.2.0 frontend calls this and silently ignores its absence,
-- so the order of deploy vs. migration does not matter.
-- ============================================================

CREATE OR REPLACE FUNCTION list_device_trips_v10(p_device_ids TEXT[])
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'name', x.name,
    'participant_id', x.participant_id,
    'joined_at', x.joined_at
  ) ORDER BY x.joined_at DESC), '[]'::jsonb)
  FROM (
    SELECT * FROM (
      -- One row per group: the most recent device link wins.
      SELECT DISTINCT ON (t.id)
        t.id, t.name, p.id AS participant_id,
        GREATEST(t.created_at, d.created_at) AS joined_at
      FROM participant_devices d
      JOIN participants p ON p.id = d.participant_id
      JOIN trips t ON t.id = p.trip_id
      WHERE d.device_id IN (
        SELECT v FROM unnest(p_device_ids[1:8]) AS v WHERE length(v) >= 16
      )
      ORDER BY t.id, d.created_at DESC
    ) per_trip
    ORDER BY joined_at DESC
    LIMIT 200
  ) x;
$$;

REVOKE ALL ON FUNCTION list_device_trips_v10(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_device_trips_v10(TEXT[]) TO anon, authenticated;
