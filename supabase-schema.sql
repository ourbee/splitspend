-- ============================================================
-- Splitspend v4 — full schema for a FRESH install
-- (Existing installs: run supabase-migration-v4.sql then
--  supabase-hardening-v4.sql instead.)
--
-- Security model: no auth. The anon key has NO direct table
-- access; all reads/writes go through SECURITY DEFINER RPCs
-- keyed by the trip UUID. Knowing the link = access.
-- Realtime uses Broadcast channels (no table replication needed).
-- ============================================================

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
  claimed_by TEXT DEFAULT '',  -- legacy single-device marker (v2/v3)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, name)
);

ALTER TABLE trips ADD CONSTRAINT fk_trips_creator FOREIGN KEY (creator_id) REFERENCES participants(id) ON DELETE SET NULL;

-- Multi-device identity (v4): one participant, many devices
CREATE TABLE participant_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_id, device_id)
);

-- Expenses
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  paid_by UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES participants(id) ON DELETE SET NULL,  -- who added it (v4)
  expense_date DATE DEFAULT CURRENT_DATE,                          -- user-set date (v4)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expense splits (which participants share this expense, and how much each)
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
CREATE INDEX idx_devices_participant ON participant_devices(participant_id);
CREATE INDEX idx_devices_device ON participant_devices(device_id);

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

-- Deny-all posture: RLS on, no policies, no table grants for the
-- public key. The RPCs below are the only access path.
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON trips, participants, expenses, expense_splits,
           settlement_records, participant_devices
FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- ------------------------------------------------------------
-- RPC API: see supabase-migration-v4.sql for the definitions of
--   get_trip_data, create_trip_v4, claim_identity_v4,
--   release_identity_v4, validate_expense_input, add_expense_v4,
--   update_expense_v4, delete_expense_v4, add_participant_v4,
--   update_participant_emoji_v4, record_settlement_v4,
--   undo_settlement_v4, ping
-- Run section 3 of that file after this one on a fresh install.
-- ------------------------------------------------------------
