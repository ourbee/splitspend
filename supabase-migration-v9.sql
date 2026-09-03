-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v8 -> v9 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- BEFORE deploying the v9 frontend.
--
-- Nothing is dropped, renamed or given a new signature. This
-- migration relaxes exactly one check.
--
-- What changes, and that is all of it:
--   * create_trip_v4 accepted a minimum of TWO participants. A
--     Splitspend is a diary as much as a ledger, and one person
--     keeping their own record of a trip has nothing to split —
--     so the minimum is now ONE. Everything else in the function
--     is byte-for-byte what v4 shipped.
--
-- This is a loosening, so the currently deployed v8 bundle (which
-- never sends fewer than two) keeps working unchanged while it is
-- in place, and can be rolled back to at any time.
-- ============================================================

CREATE OR REPLACE FUNCTION create_trip_v4(
  p_name TEXT,
  p_currency TEXT,
  p_participants JSONB,
  p_creator_index INT,
  p_device_id TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trip_id UUID;
  v_ids UUID[] := '{}';
  v_p JSONB;
  v_id UUID;
  v_creator UUID;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'A name is required';
  END IF;
  -- v9: was < 2. Solo Splitspends are allowed.
  IF p_participants IS NULL OR jsonb_array_length(p_participants) < 1 THEN
    RAISE EXCEPTION 'At least 1 participant is required';
  END IF;

  INSERT INTO trips (name, currency) VALUES (trim(p_name), COALESCE(p_currency, 'INR'))
  RETURNING id INTO v_trip_id;

  FOR v_p IN SELECT * FROM jsonb_array_elements(p_participants)
  LOOP
    INSERT INTO participants (trip_id, name, emoji)
    VALUES (v_trip_id, trim(v_p->>'name'), COALESCE(v_p->>'emoji', ''))
    RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  v_creator := v_ids[COALESCE(p_creator_index, 0) + 1];
  IF v_creator IS NULL THEN
    v_creator := v_ids[1];
  END IF;

  UPDATE trips SET creator_id = v_creator WHERE id = v_trip_id;
  UPDATE participants SET claimed_by = p_device_id WHERE id = v_creator;
  INSERT INTO participant_devices (participant_id, device_id)
  VALUES (v_creator, p_device_id)
  ON CONFLICT DO NOTHING;

  RETURN v_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip_v4(TEXT, TEXT, JSONB, INT, TEXT) TO anon, authenticated;
