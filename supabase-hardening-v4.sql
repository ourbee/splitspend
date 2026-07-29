-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v4 Hardening — STEP 2 of 2
-- Run this ONLY AFTER the v4 frontend is deployed and verified.
-- It cuts off all direct table access for the public API key,
-- leaving the SECURITY DEFINER RPCs (created in step 1) as the
-- only way in. This breaks v1/v2/v3 clients by design.
-- ============================================================

-- Public key can no longer read or write tables directly.
-- Before this, anyone with the (public) anon key could dump or
-- delete the entire database. After this, every operation
-- requires knowing a trip's UUID and goes through validated RPCs.
REVOKE ALL ON trips, participants, expenses, expense_splits,
           settlement_records, participant_devices
FROM anon, authenticated;

-- Make sure future tables don't silently reopen the door
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- The permissive policies are now unreachable; drop them for clarity.
-- RLS stays ENABLED with no policies = deny-all as defence in depth.
DROP POLICY IF EXISTS "Allow all on trips" ON trips;
DROP POLICY IF EXISTS "Allow all on participants" ON participants;
DROP POLICY IF EXISTS "Allow all on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow all on expense_splits" ON expense_splits;
DROP POLICY IF EXISTS "Allow all on settlement_records" ON settlement_records;

-- Retire the legacy invoker-rights RPCs (superseded by *_v4)
DROP FUNCTION IF EXISTS add_expense(UUID, TEXT, NUMERIC, UUID, JSONB);
DROP FUNCTION IF EXISTS update_expense(UUID, TEXT, NUMERIC, UUID, JSONB);

-- validate_expense_input is internal-only; the public key never
-- needs to call it directly.
REVOKE EXECUTE ON FUNCTION validate_expense_input(UUID, NUMERIC, UUID, JSONB) FROM anon, authenticated, public;
