-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- ============================================================
-- SplitSpend v6 -> v7 Migration (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- BEFORE deploying the v7 frontend.
--
-- Nothing is dropped or renamed. Every v4/v5/v6 RPC keeps its exact
-- signature, so the currently deployed v6 bundle carries on working
-- unchanged while this is in place.
--
-- What changes:
--   * expenses gains three nullable columns — line_items (the rows
--     read off a photographed bill), category and subcategory (the
--     labels the Reports tab groups by). All three are NULL for
--     every existing row, which every code path already tolerates.
--   * add_expense_v7 / update_expense_v7 — v5's signatures plus
--     those three. v5 stays in place and keeps working.
--   * set_expense_labels_v7 — writes category/subcategory for many
--     expenses in one call. This is how the Reports tab backfills a
--     trip's history, and how a manual re-categorisation is saved.
--   * get_trip_data is replaced only to add the three new keys.
--
-- ping() is untouched: the keep-alive cron keeps working.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS line_items JSONB;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Reports read every labelled expense in a trip at once.
CREATE INDEX IF NOT EXISTS idx_expenses_trip_category
  ON expenses(trip_id, category);

-- ------------------------------------------------------------
-- 2. Line-item sanitiser
-- ------------------------------------------------------------
-- Bill rows arrive from a vision model by way of a phone, so they are
-- treated as hostile input: only the four keys we render survive, names
-- are trimmed and length-capped, numbers are coerced, and the array is
-- capped so one absurd receipt can't bloat a row.
--
-- Line items are a RECORD ONLY. They are never read back into the split
-- maths — expenses.amount stays the single authority for what was paid,
-- and every balance in the app is computed from it alone.
CREATE OR REPLACE FUNCTION sanitize_line_items(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_out JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(row_out), '[]'::jsonb) INTO v_out
  FROM (
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'name', left(btrim(COALESCE(item->>'name', '')), 120),
      'qty', CASE
               WHEN btrim(COALESCE(item->>'qty', '')) = '' THEN NULL
               ELSE left(btrim(item->>'qty'), 24)
             END,
      'unit_price', CASE
                      WHEN (item->>'unit_price') ~ '^-?[0-9]+(\.[0-9]+)?$'
                        THEN round((item->>'unit_price')::NUMERIC, 2)
                      ELSE NULL
                    END,
      'amount', CASE
                  WHEN (item->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN round((item->>'amount')::NUMERIC, 2)
                  ELSE NULL
                END
    )) AS row_out
    FROM jsonb_array_elements(p_items) AS item
    WHERE btrim(COALESCE(item->>'name', '')) <> ''
    LIMIT 200
  ) li;

  -- An array that sanitised down to nothing is stored as NULL, so
  -- "has line items" is a single IS NOT NULL check everywhere.
  IF v_out = '[]'::jsonb THEN
    RETURN NULL;
  END IF;
  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION sanitize_line_items(JSONB) FROM anon, authenticated, public;

-- Labels are free text here on purpose. The fixed taxonomy lives in the
-- client (src/lib/taxonomy.js) because it is a presentation concern that
-- should be changeable without a migration; the database only guarantees
-- the values are short and trimmed, so a model that ignores its
-- instructions can't write an essay into the column.
CREATE OR REPLACE FUNCTION sanitize_label(p_label TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(left(btrim(COALESCE(p_label, '')), 40), '');
$$;

REVOKE EXECUTE ON FUNCTION sanitize_label(TEXT) FROM anon, authenticated, public;

-- ------------------------------------------------------------
-- 3. Expense RPCs — v5 plus bill rows and labels
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_expense_v7(
  p_trip_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_created_by UUID DEFAULT NULL,
  p_expense_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL,
  p_line_items JSONB DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_subcategory TEXT DEFAULT NULL
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
                        expense_date, note, emoji, sort_order,
                        line_items, category, subcategory)
  VALUES (
    p_trip_id, p_description, p_amount, p_paid_by,
    p_created_by, v_date,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    NULLIF(btrim(COALESCE(p_emoji, '')), ''),
    next_sort_order(p_trip_id, v_date),
    sanitize_line_items(p_line_items),
    sanitize_label(p_category),
    sanitize_label(p_subcategory)
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT v_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;

  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_expense_v7(
  p_trip_id UUID,
  p_expense_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_expense_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_emoji TEXT DEFAULT NULL,
  p_line_items JSONB DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_subcategory TEXT DEFAULT NULL
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
      line_items = sanitize_line_items(p_line_items),
      category = sanitize_label(p_category),
      subcategory = sanitize_label(p_subcategory),
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
-- 4. Bulk labelling
-- ------------------------------------------------------------
-- p_labels is [{ "id": uuid, "category": text, "subcategory": text }].
-- One call relabels a whole trip's history, which is what the Reports
-- tab does the first time it opens on a group created before v7 —
-- otherwise backfilling forty expenses would be forty round-trips.
--
-- Scoped by trip_id in the WHERE, so a forged id belonging to another
-- group simply matches nothing. Nothing but the two label columns can
-- be written through here.
CREATE OR REPLACE FUNCTION set_expense_labels_v7(
  p_trip_id UUID,
  p_labels JSONB
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' THEN
    RETURN 0;
  END IF;

  PERFORM 1 FROM trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  WITH incoming AS (
    SELECT
      (l->>'id')::UUID AS id,
      sanitize_label(l->>'category') AS category,
      sanitize_label(l->>'subcategory') AS subcategory
    FROM jsonb_array_elements(p_labels) AS l
    -- Matched to the exact UUID shape, not just "36 legal characters":
    -- a string of 36 dashes would pass the looser test and then blow up
    -- the whole call on the ::UUID cast.
    WHERE (l->>'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    LIMIT 500
  ),
  updated AS (
    UPDATE expenses e
    SET category = i.category,
        subcategory = i.subcategory
    FROM incoming i
    WHERE e.id = i.id AND e.trip_id = p_trip_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION add_expense_v7(UUID, TEXT, NUMERIC, UUID, JSONB, UUID, DATE, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_expense_v7(UUID, UUID, TEXT, NUMERIC, UUID, JSONB, DATE, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_expense_labels_v7(UUID, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5. get_trip_data — same shape plus line_items, category, subcategory
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
    'line_items', e.line_items,
    'category', e.category,
    'subcategory', e.subcategory,
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
