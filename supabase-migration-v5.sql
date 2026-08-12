-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v4 -> v5 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query).
--
-- Nothing is dropped or renamed. Every v4 RPC keeps its exact
-- signature and behaviour, so the currently deployed v4.1 bundle
-- carries on working unchanged while this is in place — run it
-- before deploying the v5 frontend, not after.
--
-- get_trip_data is replaced, but only to add new keys and to sort
-- each day by the new sort_order (which is backfilled from
-- created_at, i.e. exactly the order it already returns). Older
-- clients ignore keys they don't know.
--
-- ping() is untouched: the keep-alive cron keeps working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns
-- ------------------------------------------------------------

-- Free-text note on an expense ("Bikram's birthday dinner").
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note TEXT;

-- Explicit emoji for an expense. NULL means "keep guessing from the
-- description" — that way editing the text of an untouched expense
-- re-runs the guess, while a hand-picked emoji is never overwritten.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Manual ordering within a day. Fractional so that dropping a card
-- between two others writes ONE row (the midpoint) instead of
-- renumbering the whole day.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION;

-- Chosen palette slot for a person. NULL = keep the automatic colour
-- derived from their position in the list, which is what every
-- existing group is using today.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS color SMALLINT;

-- ------------------------------------------------------------
-- 2. Backfill sort_order from the order the app already shows
-- ------------------------------------------------------------
-- Newest-first within each (trip, day), spaced by 1000 so there is
-- room to insert between neighbours many times before a rebalance.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY trip_id, expense_date
           ORDER BY created_at DESC
         ) * 1000.0 AS pos
  FROM expenses
  WHERE sort_order IS NULL
)
UPDATE expenses e
SET sort_order = ranked.pos
FROM ranked
WHERE e.id = ranked.id;

-- ------------------------------------------------------------
-- 3. Constraints and indexes
-- ------------------------------------------------------------

-- Two people in the same group can never hold the same palette slot.
-- Enforced here rather than in the UI so that two devices picking the
-- same colour at the same moment can't both win.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_participant_color
  ON participants(trip_id, color) WHERE color IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_day_order
  ON expenses(trip_id, expense_date, sort_order);

-- ------------------------------------------------------------
-- 4. get_trip_data — same shape plus note/emoji/sort_order/color
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_trip_data(p_trip_id UUID, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trip JSONB;
  v_participants JSONB;
  v_expenses JSONB;
  v_settlements JSONB;
BEGIN
  SELECT to_jsonb(t) INTO v_trip FROM trips t WHERE t.id = p_trip_id;
  IF v_trip IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'emoji', p.emoji,
    'color', p.color,
    'created_at', p.created_at,
    'claimed', EXISTS (SELECT 1 FROM participant_devices d WHERE d.participant_id = p.id),
    'is_me', EXISTS (SELECT 1 FROM participant_devices d WHERE d.participant_id = p.id AND d.device_id = p_device_id)
  ) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_participants
  FROM participants p WHERE p.trip_id = p_trip_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'description', e.description,
    'amount', e.amount,
    'paid_by', e.paid_by,
    'created_by', e.created_by,
    'expense_date', e.expense_date,
    'created_at', e.created_at,
    'note', e.note,
    'emoji', e.emoji,
    'sort_order', e.sort_order,
    'splits', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'participant_id', s.participant_id,
        'share_amount', s.share_amount)), '[]'::jsonb)
      FROM expense_splits s WHERE s.expense_id = e.id
    )
  ) ORDER BY e.expense_date DESC, e.sort_order ASC NULLS LAST, e.created_at DESC), '[]'::jsonb)
  INTO v_expenses
  FROM expenses e WHERE e.trip_id = p_trip_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.settled_at DESC), '[]'::jsonb)
  INTO v_settlements
  FROM settlement_records r WHERE r.trip_id = p_trip_id;

  RETURN jsonb_build_object(
    'trip', v_trip,
    'participants', v_participants,
    'expenses', v_expenses,
    'settlement_records', v_settlements
  );
END;
$$;

-- ------------------------------------------------------------
-- 5. Expense writes with note + emoji
--    (add_expense_v4 / update_expense_v4 are left exactly as they
--     are, so a phone running a cached v4.1 bundle still works.)
-- ------------------------------------------------------------

-- A new expense lands at the TOP of its day, matching newest-first.
CREATE OR REPLACE FUNCTION next_sort_order(p_trip_id UUID, p_date DATE)
RETURNS DOUBLE PRECISION
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(MIN(sort_order) - 1000, 1000)
  FROM expenses WHERE trip_id = p_trip_id AND expense_date = p_date;
$$;

REVOKE EXECUTE ON FUNCTION next_sort_order(UUID, DATE) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION add_expense_v5(
  p_trip_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_created_by UUID DEFAULT NULL,
  p_expense_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
  v_date DATE;
BEGIN
  PERFORM validate_expense_input(p_trip_id, p_amount, p_paid_by, p_splits);

  v_date := COALESCE(p_expense_date, CURRENT_DATE);

  INSERT INTO expenses (trip_id, description, amount, paid_by, created_by,
                        expense_date, note, emoji, sort_order)
  VALUES (
    p_trip_id, p_description, p_amount, p_paid_by,
    p_created_by, v_date,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_emoji, '')), ''),
    next_sort_order(p_trip_id, v_date)
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT v_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;

  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_expense_v5(
  p_trip_id UUID,
  p_expense_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_expense_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_date DATE;
  v_new_date DATE;
BEGIN
  SELECT expense_date INTO v_old_date
  FROM expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found in this group';
  END IF;

  PERFORM validate_expense_input(p_trip_id, p_amount, p_paid_by, p_splits);

  v_new_date := COALESCE(p_expense_date, v_old_date);

  UPDATE expenses
  SET description = p_description,
      amount = p_amount,
      paid_by = p_paid_by,
      expense_date = v_new_date,
      note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      emoji = NULLIF(btrim(COALESCE(p_emoji, '')), ''),
      -- Moved to another day? Take a slot at the top of the new one,
      -- otherwise keep the hand-arranged position.
      sort_order = CASE
        WHEN v_new_date IS DISTINCT FROM v_old_date
          THEN next_sort_order(p_trip_id, v_new_date)
        ELSE sort_order
      END
  WHERE id = p_expense_id;

  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT p_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;
END;
$$;

-- ------------------------------------------------------------
-- 6. Manual reordering within a day
-- ------------------------------------------------------------
-- The client sends the midpoint between the two cards the expense was
-- dropped between. Repeated splitting of the same gap eventually runs
-- out of precision, so once neighbours get closer than 1.0 the day is
-- renumbered back to clean multiples of 1000.
CREATE OR REPLACE FUNCTION reorder_expense_v5(
  p_trip_id UUID,
  p_expense_id UUID,
  p_sort_order DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_min_gap DOUBLE PRECISION;
BEGIN
  SELECT expense_date INTO v_date
  FROM expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found in this group';
  END IF;

  -- Postgres treats NaN = NaN as true, so guard the special values explicitly.
  IF p_sort_order IS NULL
     OR p_sort_order = 'NaN'::DOUBLE PRECISION
     OR p_sort_order = 'Infinity'::DOUBLE PRECISION
     OR p_sort_order = '-Infinity'::DOUBLE PRECISION THEN
    RAISE EXCEPTION 'Invalid position';
  END IF;

  UPDATE expenses SET sort_order = p_sort_order WHERE id = p_expense_id;

  SELECT MIN(gap) INTO v_min_gap FROM (
    SELECT sort_order - lag(sort_order) OVER (ORDER BY sort_order) AS gap
    FROM expenses
    WHERE trip_id = p_trip_id AND expense_date = v_date
  ) g WHERE gap IS NOT NULL;

  IF v_min_gap IS NOT NULL AND v_min_gap < 1.0 THEN
    WITH renumbered AS (
      SELECT id, row_number() OVER (ORDER BY sort_order, created_at DESC) * 1000.0 AS pos
      FROM expenses
      WHERE trip_id = p_trip_id AND expense_date = v_date
    )
    UPDATE expenses e
    SET sort_order = renumbered.pos
    FROM renumbered
    WHERE e.id = renumbered.id;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 7. Personal colour
-- ------------------------------------------------------------
-- Returns { ok: true } or { ok: false, reason: 'taken' } — the same
-- shape claim_identity_v4 uses, so the client handles the race the
-- same way it already handles two people claiming one identity.
CREATE OR REPLACE FUNCTION update_participant_color_v5(
  p_trip_id UUID,
  p_participant_id UUID,
  p_color SMALLINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM participants
  WHERE id = p_participant_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant is not part of this group';
  END IF;

  IF p_color IS NOT NULL AND (p_color < 0 OR p_color > 49) THEN
    RAISE EXCEPTION 'Unknown colour';
  END IF;

  UPDATE participants SET color = p_color WHERE id = p_participant_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
END;
$$;
