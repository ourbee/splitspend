-- Copyright © 2026 Ritwik Balo. All rights reserved.
-- https://github.com/ourbee

-- Splitspend v1 -> v2 Migration
-- Run this in Supabase SQL Editor if you are upgrading from v1.
-- This preserves all existing data.

-- Add emoji and claimed_by columns to participants
ALTER TABLE participants ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS claimed_by TEXT DEFAULT '';

-- Add creator_id to trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE trips ADD CONSTRAINT fk_trips_creator FOREIGN KEY (creator_id) REFERENCES participants(id) ON DELETE SET NULL;

-- Create settlement_records table
CREATE TABLE IF NOT EXISTS settlement_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  from_participant UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  to_participant UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  settled_at TIMESTAMPTZ DEFAULT now()
);

-- Index for settlement_records
CREATE INDEX IF NOT EXISTS idx_settlements_trip ON settlement_records(trip_id);

-- RLS for settlement_records
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on settlement_records" ON settlement_records FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on new tables (also enable in Dashboard > Replication)
-- Enable for: participants, settlement_records
