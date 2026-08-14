-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v5 -> v6 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- BEFORE deploying the v6 frontend.
--
-- Nothing is dropped or renamed. Every v4/v5 RPC keeps its exact
-- signature, so the currently deployed v5 bundle carries on working
-- unchanged while this is in place.
--
-- What changes:
--   * New trip_events table — non-expense diary entries. Older
--     clients never see it: it only surfaces through the new
--     'events' key in get_trip_data, which they ignore.
--   * get_trip_data is replaced only to add that 'events' key.
--   * next_sort_order and the reorder rebalance become aware of
--     events, so expenses and events share one ordering per day.
--     reorder_expense_v5 keeps its signature and behaviour.
--
-- ping() is untouched: the keep-alive cron keeps working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Events table — same deny-all posture as every other table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  emoji TEXT,
  event_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_by UUID REFERENCES participants(id) ON DELETE SET NULL,
  sort_order DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_day_order
  ON trip_events(trip_id, event_date, sort_order);

ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trip_events FROM anon, authenticated;

-- ------------------------------------------------------------
-- 2. Shared ordering helpers, now spanning both tables
-- ------------------------------------------------------------

-- A new card lands at the TOP of its day, above expenses AND events.
CREATE OR REPLACE FUNCTION next_sort_order(p_trip_id UUID, p_date DATE)
RETURNS DOUBLE PRECISION
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(MIN(so) - 1000, 1000) FROM (
    SELECT sort_order AS so FROM expenses
    WHERE trip_id = p_trip_id AND expense_date = p_date
    UNION ALL
    SELECT sort_order FROM trip_events
    WHERE trip_id = p_trip_id AND event_date = p_date
  ) u;
$$;

REVOKE EXECUTE ON FUNCTION next_sort_order(UUID, DATE) FROM anon, authenticated, public;

-- Repeatedly dropping cards into the same gap eventually exhausts the
-- fractional precision; once any two neighbours in a day sit closer
-- than 1.0, renumber the whole day — expenses and events together —
-- back to clean multiples of 1000.
CREATE OR REPLACE FUNCTION rebalance_day_v6(p_trip_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_min_gap DOUBLE PRECISION;
BEGIN
  SELECT MIN(gap) INTO v_min_gap FROM (
    SELECT so - lag(so) OVER (ORDER BY so) AS gap FROM (
      SELECT sort_order AS so FROM expenses
      WHERE trip_id = p_trip_id AND expense_date = p_date AND sort_order IS NOT NULL
      UNION ALL
      SELECT sort_order FROM trip_events
      WHERE trip_id = p_trip_id AND event_date = p_date AND sort_order IS NOT NULL
    ) u
  ) g WHERE gap IS NOT NULL;

  IF v_min_gap IS NULL OR v_min_gap >= 1.0 THEN
    RETURN;
  END IF;

  WITH renumbered AS (
    SELECT id, kind, row_number() OVER (ORDER BY so, created_at DESC) * 1000.0 AS pos
    FROM (
      SELECT id, 'expense' AS kind, sort_order AS so, created_at FROM expenses
      WHERE trip_id = p_trip_id AND expense_date = p_date
      UNION ALL
      SELECT id, 'event', sort_order, created_at FROM trip_events
      WHERE trip_id = p_trip_id AND event_date = p_date
    ) u
  ),
  upd_expenses AS (
    UPDATE expenses e SET sort_order = r.pos
    FROM renumbered r WHERE r.kind = 'expense' AND e.id = r.id
    RETURNING 1
  )
  UPDATE trip_events t SET sort_order = r.pos
  FROM renumbered r WHERE r.kind = 'event' AND t.id = r.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION rebalance_day_v6(UUID, DATE) FROM anon, authenticated, public;

-- Same signature and observable behaviour as before — the gap check and
-- renumbering just cover events in the day too, so a mixed day can't end
-- up with two cards fighting over one position.
CREATE OR REPLACE FUNCTION reorder_expense_v5(
  p_trip_id UUID,
  p_expense_id UUID,
  p_sort_order DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE;
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
  PERFORM rebalance_day_v6(p_trip_id, v_date);
END;
$$;

-- ------------------------------------------------------------
-- 3. Event RPCs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_event_v6(
  p_trip_id UUID,
  p_title TEXT,
  p_created_by UUID DEFAULT NULL,
  p_event_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_date DATE;
BEGIN
  PERFORM 1 FROM trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_created_by IS NOT NULL THEN
    PERFORM 1 FROM participants WHERE id = p_created_by AND trip_id = p_trip_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participant is not part of this group';
    END IF;
  END IF;

  v_date := COALESCE(p_event_date, CURRENT_DATE);

  INSERT INTO trip_events (trip_id, title, note, emoji, event_date, created_by, sort_order)
  VALUES (
    p_trip_id, btrim(p_title),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_emoji, '')), ''),
    v_date, p_created_by,
    next_sort_order(p_trip_id, v_date)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_event_v6(
  p_trip_id UUID,
  p_event_id UUID,
  p_title TEXT,
  p_event_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_date DATE;
  v_new_date DATE;
BEGIN
  SELECT event_date INTO v_old_date
  FROM trip_events WHERE id = p_event_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found in this group';
  END IF;
  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  v_new_date := COALESCE(p_event_date, v_old_date);

  UPDATE trip_events
  SET title = btrim(p_title),
      note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      emoji = NULLIF(btrim(COALESCE(p_emoji, '')), ''),
      event_date = v_new_date,
      -- Moved to another day? Take a slot at the top of the new one,
      -- otherwise keep the hand-arranged position.
      sort_order = CASE
        WHEN v_new_date IS DISTINCT FROM v_old_date
          THEN next_sort_order(p_trip_id, v_new_date)
        ELSE sort_order
      END
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_event_v6(
  p_trip_id UUID,
  p_event_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM trip_events WHERE id = p_event_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found in this group';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reorder_event_v6(
  p_trip_id UUID,
  p_event_id UUID,
  p_sort_order DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date DATE;
BEGIN
  SELECT event_date INTO v_date
  FROM trip_events WHERE id = p_event_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found in this group';
  END IF;

  IF p_sort_order IS NULL
     OR p_sort_order = 'NaN'::DOUBLE PRECISION
     OR p_sort_order = 'Infinity'::DOUBLE PRECISION
     OR p_sort_order = '-Infinity'::DOUBLE PRECISION THEN
    RAISE EXCEPTION 'Invalid position';
  END IF;

  UPDATE trip_events SET sort_order = p_sort_order WHERE id = p_event_id;
  PERFORM rebalance_day_v6(p_trip_id, v_date);
END;
$$;

-- The four event RPCs are the only way in — the table itself stays
-- unreachable. Stated explicitly rather than relying on Postgres's
-- default PUBLIC execute, which is what the older RPCs lean on.
GRANT EXECUTE ON FUNCTION add_event_v6(UUID, TEXT, UUID, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_event_v6(UUID, UUID, TEXT, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_event_v6(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reorder_event_v6(UUID, UUID, DOUBLE PRECISION) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. get_trip_data — same shape plus an 'events' key
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_trip_data(p_trip_id UUID, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trip JSONB;
  v_participants JSONB;
  v_expenses JSONB;
  v_events JSONB;
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
  -- create_trip_v4 inserts a group's participants in one transaction, so they
  -- all share a created_at. Ordering by it alone is a total tie and the plan
  -- is free to return them in any order — which reshuffles every automatic
  -- colour. p.id pins it.
  ) ORDER BY p.created_at, p.id), '[]'::jsonb)
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ev.id,
    'title', ev.title,
    'note', ev.note,
    'emoji', ev.emoji,
    'event_date', ev.event_date,
    'created_by', ev.created_by,
    'created_at', ev.created_at,
    'sort_order', ev.sort_order
  ) ORDER BY ev.event_date DESC, ev.sort_order ASC NULLS LAST, ev.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM trip_events ev WHERE ev.trip_id = p_trip_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.settled_at DESC), '[]'::jsonb)
  INTO v_settlements
  FROM settlement_records r WHERE r.trip_id = p_trip_id;

  RETURN jsonb_build_object(
    'trip', v_trip,
    'participants', v_participants,
    'expenses', v_expenses,
    'events', v_events,
    'settlement_records', v_settlements
  );
END;
$$;
