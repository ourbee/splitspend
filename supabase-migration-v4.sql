-- ============================================================
-- SplitSpend v3 -> v4 Migration — STEP 1 of 2 (ADDITIVE, SAFE)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query).
-- The old app keeps working while this is in place. After the new
-- frontend is deployed and verified, run supabase-hardening-v4.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Multi-device identity: one participant, many devices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participant_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_devices_participant ON participant_devices(participant_id);
CREATE INDEX IF NOT EXISTS idx_devices_device ON participant_devices(device_id);

-- Lock the new table down immediately (only RPCs below may touch it)
ALTER TABLE participant_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON participant_devices FROM anon, authenticated;

-- Seed from the legacy single-device claimed_by field
INSERT INTO participant_devices (participant_id, device_id)
SELECT id, claimed_by FROM participants WHERE claimed_by <> ''
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 2. Expense attribution + real expense dates
-- ------------------------------------------------------------
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES participants(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE;
UPDATE expenses SET expense_date = created_at::date WHERE expense_date IS NULL;

-- ------------------------------------------------------------
-- 3. RPC API (SECURITY DEFINER — the only door into the data
--    once supabase-hardening-v4.sql is run). Every function is
--    keyed by the trip UUID: knowing the link = access, nothing
--    else is reachable.
-- ------------------------------------------------------------

-- Read everything for one trip in a single round-trip
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
    'splits', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'participant_id', s.participant_id,
        'share_amount', s.share_amount)), '[]'::jsonb)
      FROM expense_splits s WHERE s.expense_id = e.id
    )
  ) ORDER BY e.expense_date DESC, e.created_at DESC), '[]'::jsonb)
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

-- Create a trip with participants atomically; creator claims via device
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
  IF p_participants IS NULL OR jsonb_array_length(p_participants) < 2 THEN
    RAISE EXCEPTION 'At least 2 participants are required';
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

-- Claim (or re-claim from a new device) an identity.
-- p_expect_unclaimed = true is the "Join as" path: it fails gracefully
-- if someone else grabbed the identity in the meantime (race-safe via
-- row lock). The "Continue as X" welcome-back path passes false and
-- simply registers this device as another device of that person.
CREATE OR REPLACE FUNCTION claim_identity_v4(
  p_trip_id UUID,
  p_participant_id UUID,
  p_device_id TEXT,
  p_expect_unclaimed BOOLEAN DEFAULT false,
  p_emoji TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claimed BOOLEAN;
BEGIN
  PERFORM 1 FROM participants
  WHERE id = p_participant_id AND trip_id = p_trip_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found in this group';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM participant_devices
    WHERE participant_id = p_participant_id AND device_id <> p_device_id
  ) INTO v_claimed;

  IF p_expect_unclaimed AND v_claimed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;

  INSERT INTO participant_devices (participant_id, device_id)
  VALUES (p_participant_id, p_device_id)
  ON CONFLICT DO NOTHING;

  UPDATE participants SET claimed_by = p_device_id WHERE id = p_participant_id;

  IF p_emoji IS NOT NULL AND p_emoji <> '' THEN
    UPDATE participants SET emoji = p_emoji WHERE id = p_participant_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'was_claimed', v_claimed);
END;
$$;

-- Detach this device from an identity ("Switch identity")
CREATE OR REPLACE FUNCTION release_identity_v4(
  p_trip_id UUID,
  p_participant_id UUID,
  p_device_id TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM participant_devices d
  USING participants p
  WHERE d.participant_id = p.id
    AND p.id = p_participant_id
    AND p.trip_id = p_trip_id
    AND d.device_id = p_device_id;

  -- Clear legacy field if no devices remain
  UPDATE participants SET claimed_by = ''
  WHERE id = p_participant_id
    AND trip_id = p_trip_id
    AND NOT EXISTS (SELECT 1 FROM participant_devices WHERE participant_id = p_participant_id);
END;
$$;

-- Shared validation for expense splits
CREATE OR REPLACE FUNCTION validate_expense_input(
  p_trip_id UUID,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC;
  v_count INT;
  v_valid INT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  PERFORM 1 FROM participants WHERE id = p_paid_by AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payer is not part of this group';
  END IF;

  SELECT COALESCE(SUM((s->>'share_amount')::NUMERIC), 0), COUNT(*)
  INTO v_sum, v_count
  FROM jsonb_array_elements(p_splits) s;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'At least one person must share the expense';
  END IF;

  IF abs(v_sum - p_amount) > 0.011 THEN
    RAISE EXCEPTION 'Split amounts (%) must add up to the total (%)', round(v_sum, 2), round(p_amount, 2);
  END IF;

  PERFORM 1 FROM jsonb_array_elements(p_splits) s
  WHERE (s->>'share_amount')::NUMERIC < 0;
  IF FOUND THEN
    RAISE EXCEPTION 'Share amounts cannot be negative';
  END IF;

  SELECT COUNT(*) INTO v_valid
  FROM jsonb_array_elements(p_splits) s
  JOIN participants p ON p.id = (s->>'participant_id')::UUID AND p.trip_id = p_trip_id;
  IF v_valid <> v_count THEN
    RAISE EXCEPTION 'A split participant is not part of this group';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION add_expense_v4(
  p_trip_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_created_by UUID DEFAULT NULL,
  p_expense_date DATE DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
BEGIN
  PERFORM validate_expense_input(p_trip_id, p_amount, p_paid_by, p_splits);

  INSERT INTO expenses (trip_id, description, amount, paid_by, created_by, expense_date)
  VALUES (
    p_trip_id, p_description, p_amount, p_paid_by,
    p_created_by,
    COALESCE(p_expense_date, CURRENT_DATE)
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT v_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;

  RETURN v_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_expense_v4(
  p_trip_id UUID,
  p_expense_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB,
  p_expense_date DATE DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found in this group';
  END IF;

  PERFORM validate_expense_input(p_trip_id, p_amount, p_paid_by, p_splits);

  UPDATE expenses
  SET description = p_description,
      amount = p_amount,
      paid_by = p_paid_by,
      expense_date = COALESCE(p_expense_date, expense_date)
  WHERE id = p_expense_id;

  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT p_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;
END;
$$;

CREATE OR REPLACE FUNCTION delete_expense_v4(p_trip_id UUID, p_expense_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM expenses WHERE id = p_expense_id AND trip_id = p_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_participant_v4(p_trip_id UUID, p_name TEXT, p_emoji TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row participants;
BEGIN
  PERFORM 1 FROM trips WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'A name is required';
  END IF;

  BEGIN
    INSERT INTO participants (trip_id, name, emoji)
    VALUES (p_trip_id, trim(p_name), COALESCE(p_emoji, ''))
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'A participant with this name already exists';
  END;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION update_participant_emoji_v4(
  p_trip_id UUID,
  p_participant_id UUID,
  p_emoji TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE participants SET emoji = COALESCE(p_emoji, '')
  WHERE id = p_participant_id AND trip_id = p_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION record_settlement_v4(
  p_trip_id UUID,
  p_from UUID,
  p_to UUID,
  p_amount NUMERIC
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION 'Cannot settle with yourself';
  END IF;
  PERFORM 1 FROM participants WHERE id = p_from AND trip_id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found in this group'; END IF;
  PERFORM 1 FROM participants WHERE id = p_to AND trip_id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found in this group'; END IF;

  INSERT INTO settlement_records (trip_id, from_participant, to_participant, amount)
  VALUES (p_trip_id, p_from, p_to, p_amount)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION undo_settlement_v4(p_trip_id UUID, p_settlement_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM settlement_records WHERE id = p_settlement_id AND trip_id = p_trip_id;
END;
$$;

-- Keep-alive target for the Vercel cron (counts as project API activity)
CREATE OR REPLACE FUNCTION ping()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM trips;
  RETURN 'ok:' || v_count;
END;
$$;
