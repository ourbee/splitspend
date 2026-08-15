-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v7 -> v8 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- BEFORE deploying the v8 frontend.
--
-- Nothing is dropped or renamed. Every v4/v5/v6/v7 RPC keeps its
-- exact signature, so the currently deployed v7 bundle carries on
-- working unchanged while this is in place.
--
-- What changes, and that is all of it:
--   * trips gains three nullable columns — summary (the written
--     paragraph the Trip Diary opens with), summary_hash (a
--     fingerprint of the trip content the summary was written
--     from, so the app can tell a stale summary from a current
--     one) and summary_at.
--   * set_trip_summary_v8 — writes those three. Text only: no
--     amount, split, date or label can be reached through it, so a
--     bad summary is always a cosmetic problem and never a
--     financial one.
--
-- get_trip_data is NOT replaced. It returns the trip row as
-- to_jsonb(t), so the three new columns reach the client the
-- moment they exist — and older bundles simply ignore keys they
-- do not know about.
--
-- ping() is untouched: the keep-alive cron keeps working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
ALTER TABLE trips ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS summary_hash TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS summary_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2. set_trip_summary_v8
--
-- Called both by "write me a summary" (model text + the hash of
-- what it was written from) and by a hand edit of that text. The
-- hash is stored verbatim as the client computed it; the server
-- only bounds its length. Passing NULL/empty summary clears all
-- three columns, which is how "delete this summary" works.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_trip_summary_v8(
  p_trip_id UUID,
  p_summary TEXT,
  p_hash TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_text TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trips WHERE id = p_trip_id) THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;

  v_text := NULLIF(btrim(COALESCE(p_summary, '')), '');

  UPDATE trips SET
    -- A 500-word paragraph is ~3 kB; the ceiling is only here so a
    -- broken client cannot park a novel in the row.
    summary      = CASE WHEN v_text IS NULL THEN NULL ELSE left(v_text, 8000) END,
    summary_hash = CASE WHEN v_text IS NULL THEN NULL
                        ELSE NULLIF(left(btrim(COALESCE(p_hash, '')), 64), '') END,
    summary_at   = CASE WHEN v_text IS NULL THEN NULL ELSE now() END
  WHERE id = p_trip_id;

  RETURN TRUE;
END;
$$;

-- The hardening file revokes default privileges on TABLES only, so a
-- new function would inherit PUBLIC execute anyway. Granted explicitly
-- so the intent is on the record rather than inherited by accident.
GRANT EXECUTE ON FUNCTION set_trip_summary_v8(UUID, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Done. Verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'trips' AND column_name LIKE 'summary%';
--
-- Expect three rows: summary, summary_at, summary_hash.
-- ============================================================
