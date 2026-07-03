-- SplitSpend v2 -> v3 Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This preserves all existing data. No schema changes needed.

-- New RPC function for editing expenses (update + replace splits atomically)
CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_paid_by UUID,
  p_splits JSONB
) RETURNS VOID AS $$
BEGIN
  -- Update expense details
  UPDATE expenses
  SET description = p_description, amount = p_amount, paid_by = p_paid_by
  WHERE id = p_expense_id;

  -- Replace splits: delete old, insert new
  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  INSERT INTO expense_splits (expense_id, participant_id, share_amount)
  SELECT p_expense_id, (s->>'participant_id')::UUID, (s->>'share_amount')::NUMERIC
  FROM jsonb_array_elements(p_splits) AS s;
END;
$$ LANGUAGE plpgsql;
