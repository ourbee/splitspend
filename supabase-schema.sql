-- Splitspend v2 Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- NOTE: If upgrading from v1, run supabase-migration-v2.sql instead.

-- Trips table
CREATE TABLE trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'INR',
  creator_id UUID,  -- references participants(id), set after participant creation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Participants in a trip
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '',
  claimed_by TEXT DEFAULT '',  -- localStorage identity marker; empty = unclaimed
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, name)
);

-- Add FK for creator_id after participants table exists
ALTER TABLE trips ADD CONSTRAINT fk_trips_creator FOREIGN KEY (creator_id) REFERENCES participants(id) ON DELETE SET NULL;

-- Expenses
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_by UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expense splits (which participants share this expense)
CREATE TABLE expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  share_amount NUMERIC(12, 2) NOT NULL,
  UNIQUE(expense_id, participant_id)
);

-- Settlement records (track when a debt is marked as paid)
CREATE TABLE settlement_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  from_participant UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  to_participant UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  settled_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_participants_trip ON participants(trip_id);
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_splits_participant ON expense_splits(participant_id);
CREATE INDEX idx_settlements_trip ON settlement_records(trip_id);

-- Auto-update trip timestamp when expenses change
CREATE OR REPLACE FUNCTION update_trip_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trips SET updated_at = now() WHERE id = NEW.trip_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_update_trip
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_trip_timestamp();

-- Row Level Security: fully open (no auth, access controlled by UUID secrecy)
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on participants" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expense_splits" ON expense_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settlement_records" ON settlement_records FOR ALL USING (true) WITH CHECK (true);

-- Atomic expense insertion function
CREATE OR REPLACE FUNCTION add_expense(
  p_trip_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB
) RETURNS UUID AS $$
DECLARE
  v_expense_id UUID;
  v_split JSONB;
BEGIN
  INSERT INTO expenses (trip_id, description, amount, paid_by)
  VALUES (p_trip_id, p_description, p_amount, p_paid_by)
  RETURNING id INTO v_expense_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO expense_splits (expense_id, participant_id, share_amount)
    VALUES (
      v_expense_id,
      (v_split->>'participant_id')::UUID,
      (v_split->>'share_amount')::NUMERIC
    );
  END LOOP;

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;

-- Enable realtime on expenses, expense_splits, participants, and settlement_records
-- NOTE: You also need to enable this in Supabase Dashboard:
-- Database > Replication > enable for 'expenses', 'expense_splits', 'participants', and 'settlement_records' tables
