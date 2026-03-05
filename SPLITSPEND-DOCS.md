# SplitSpend - Complete Project Documentation

> **Purpose of this file:** Drop this into a new Claude Code conversation for full project context. No additional files, screenshots, or attachments needed.

## Overview

**SplitSpend** is a sessionless, no-login expense-splitting web app. Users create a group, add participants, share a QR code/link, and everyone can add expenses and see who owes whom — all without accounts or authentication.

- **Live URL:** https://splitspend.vercel.app
- **Philosophy:** No accounts, no logins, no app install. Just share a link.
- **Identity model:** UUID-based access (knowing the trip URL = access). Per-device identity via localStorage + device_id token.
- **Creator:** Ritwik Balo

## Tech Stack

- **Frontend:** React 19, Vite 5, React Router 7, Zustand 5
- **Backend:** Supabase (PostgreSQL + Realtime subscriptions)
- **Hosting:** Vercel (SPA with rewrites)
- **Other:** qrcode.react for QR codes
- **Design:** Mobile-first (480px max-width), CSS variables, bottom-sheet modals

## Folder Structure

```
/Users/ritwikbalo/Desktop/My Apps/
  splitspend/        # v1 (backup, do not modify)
  splitspend-v2/     # v2 (backup, do not modify)
  splitspend-v3/     # v3 (active, deployed to Vercel)
    public/
      favicon.svg
    src/
      components/
        AboutModal.jsx
        AddExpenseModal.jsx
        AddParticipantModal.jsx
        BalanceSummary.jsx
        CreateTripForm.jsx
        ExpenseCard.jsx
        ExpenseList.jsx
        ExportModal.jsx
        QRCodeDisplay.jsx
        SettlementList.jsx
      hooks/
        useRealtime.js
        useTrip.js
      lib/
        deviceId.js
        emojis.js
        exportData.js
        settlement.js
        supabase.js
      pages/
        HomePage.jsx
        JoinPage.jsx
        TripPage.jsx
      store/
        tripStore.js
      App.css
      App.jsx
      main.jsx
    index.html
    package.json
    vite.config.js
    vercel.json
    supabase-schema.sql
    supabase-migration-v2.sql
    supabase-migration-v3.sql
    .env                # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## Version History

### v1 — Initial Release
- Basic expense splitting with Supabase backend
- Create trip, add participants, add/delete expenses
- QR code sharing, CSV export
- No identity system (all participants equal)
- No emoji support, no settlement tracking

### v2 — Identity & Settlements
- **Emoji avatars:** Each participant gets a random emoji (from 20 options), changeable via picker
- **Creator/identity system:** Creator marked with `creator_id` on trip, participants claim identity via `claimed_by` field + localStorage (`splitspend_identity_${tripId}`)
- **Join page:** `/trip/:tripId/join` — new users pick "Who are you?" from unclaimed participants
- **Settlement tracking:** New `settlement_records` table. "Mark as Settled" + "Undo" buttons. Settlement history shown.
- **About modal:** Shows app info and creator credit
- **Add participant:** Creator can add new participants after trip creation
- **Realtime:** Subscriptions on 4 tables (expenses, expense_splits, participants, settlement_records)

### v3 — Edit Expenses, Device Recognition, Neutral Language
Five changes based on user feedback:

1. **Edit expenses:** Pencil icon on each expense card opens AddExpenseModal in edit mode (pre-filled fields). New `update_expense` Supabase RPC function for atomic update + split replacement.

2. **Clean exports:** Removed emoji column from CSV export. Removed emoji field from JSON export. Participants section shows only "Name" column.

3. **Device recognition (3-layer system):**
   - Layer 1: Per-trip localStorage identity (`splitspend_identity_${tripId}`) — existing from v2
   - Layer 2: Global device UUID (`splitspend_device_id`) stored in localStorage, written to `claimed_by` field on participants table. On `fetchTrip`, if no per-trip identity found, checks if any participant's `claimed_by` matches the device_id.
   - Layer 3: "This is me" rejoin button on JoinPage for already-claimed participants (for fully lost localStorage scenarios)
   - JoinPage auto-redirects returning users who already have identity

4. **Logo/icon:** Split-circle SVG logo (two halves of a circle with gap on indigo background). Shown on HomePage and as favicon/apple-touch-icon.

5. **Neutral language (not just "trips"):**
   - CreateTripForm: "Trip Name" → "Name", placeholder: "e.g. Goa Trip, Flat Expenses, Dinner"
   - QRCodeDisplay: "Share Trip" → "Share", share text: "Join my Splitspend"
   - ExportModal: "Export Trip Data" → "Export Data"
   - AboutModal: "Your trip data lives..." → "Your data lives..."
   - BalanceSummary: "Total Trip Spend" → "Total Spend"
   - TripPage not-found: "Trip not found" → "Not found"
   - JoinPage not-found: "Trip not found" → "Not found"

---

## Database Schema

### Full Schema (supabase-schema.sql)

```sql
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
```

### Migration: v1 → v2 (supabase-migration-v2.sql)

```sql
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
```

### Migration: v2 → v3 (supabase-migration-v3.sql)

```sql
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
```

---

## Architecture

### Routing (React Router 7)
- `/` — HomePage (create new group)
- `/trip/:tripId` — TripPage (view expenses, balances, settlements)
- `/trip/:tripId/join` — JoinPage (claim identity)

### State Management (Zustand)
Single store (`tripStore.js`) holds: `trip`, `participants`, `expenses`, `settlementRecords`, `myIdentity`, `loading`, `error`.

Actions: `fetchTrip`, `createTrip`, `addExpense`, `updateExpense`, `deleteExpense`, `recordSettlement`, `undoSettlement`, `addParticipant`, `claimIdentity`, `updateParticipantEmoji`, `setIdentity`, `isCreator`, `reset`.

### Real-time Sync
`useRealtime` hook subscribes to Supabase Realtime on 4 tables (`expenses`, `expense_splits`, `participants`, `settlement_records`) filtered by `trip_id`. Any change triggers a full `fetchTrip` re-fetch.

**Important:** Realtime must be enabled in Supabase Dashboard > Database > Replication for all 4 tables.

### Identity System (No Auth)
1. **Trip creator:** On `createTrip`, the creator's participant gets `claimed_by = deviceId`. Creator's participant ID saved to localStorage as `splitspend_identity_${tripId}` and `splitspend_creator_${tripId}`.
2. **Joining participants:** JoinPage shows unclaimed participants. On selection, `claimIdentity` writes `deviceId` to `claimed_by` and saves to localStorage.
3. **Device recognition (v3):** Global `splitspend_device_id` UUID persists across trips. On `fetchTrip`, if no per-trip localStorage identity, the store checks if any participant's `claimed_by` matches the device_id and auto-recovers.
4. **Rejoin:** JoinPage shows "This is me" button for already-claimed participants.
5. **TripPage redirect:** If no identity set after loading, redirects to JoinPage.

### Settlement Algorithm
Greedy matching: calculates net balance per participant (total paid minus total owed). Separates into creditors (positive balance) and debtors (negative balance). Sorts both descending. Iteratively matches largest debtor with largest creditor, transferring the minimum of the two amounts. This minimizes the number of transactions needed.

### Split Calculation
Equal split with penny-accurate remainder handling: `shareAmount = Math.floor((amount * 100) / splitAmong.length) / 100`. Remainder goes to the first participant in the split list.

---

## Complete Source Code

### Configuration Files

#### package.json
```json
{
  "name": "splitspend-v3",
  "private": true,
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.98.0",
    "qrcode.react": "^4.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.1",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.7.0",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "vite": "^5.4.21"
  }
}
```

#### vite.config.js
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

#### vercel.json
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

#### index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#6366f1" />
    <meta name="description" content="Split expenses with friends. No login, no app install. Just scan the QR code." />
    <title>Splitspend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

#### .env (structure — actual values not included)
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### public/favicon.svg
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <clipPath id="left">
      <rect x="0" y="0" width="47" height="100"/>
    </clipPath>
    <clipPath id="right">
      <rect x="53" y="0" width="47" height="100"/>
    </clipPath>
  </defs>
  <rect width="100" height="100" rx="20" fill="#6366f1"/>
  <!-- Split circle: two halves with a clean gap -->
  <circle cx="50" cy="50" r="26" fill="none" stroke="white" stroke-width="5" clip-path="url(#left)"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="white" stroke-width="5" clip-path="url(#right)"/>
</svg>
```

### src/main.jsx
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './App.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### src/App.jsx
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import TripPage from './pages/TripPage'
import JoinPage from './pages/JoinPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip/:tripId" element={<TripPage />} />
        <Route path="/trip/:tripId/join" element={<JoinPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

### src/App.css
```css
:root {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: #eef2ff;
  --color-success: #22c55e;
  --color-success-light: #dcfce7;
  --color-danger: #ef4444;
  --color-danger-light: #fee2e2;
  --color-warning: #f59e0b;
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;

  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-modal: 0 8px 30px rgba(0, 0, 0, 0.12);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 var(--space-md);
  min-height: 100dvh;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: 12px var(--space-lg);
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  font-family: inherit;
  width: 100%;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.btn-danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  padding: var(--space-sm);
  width: auto;
}

/* Inputs */
.input {
  width: 100%;
  padding: 12px var(--space-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-family: inherit;
  transition: border-color 0.15s;
  background: var(--color-surface);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.input::placeholder {
  color: var(--color-text-muted);
}

/* Cards */
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-card);
}

/* Chips */
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 6px 12px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 500;
}

.chip-remove {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: var(--space-xs);
  background: var(--color-border);
  border-radius: var(--radius-md);
  padding: 3px;
}

.tab {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-muted);
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.tab.active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-card);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.15s ease;
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90dvh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* FAB */
.fab {
  position: fixed;
  bottom: var(--space-lg);
  right: 50%;
  transform: translateX(calc(240px - var(--space-lg)));
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  border: none;
  font-size: 28px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, background 0.15s;
  z-index: 50;
}

.fab:hover {
  background: var(--color-primary-hover);
}

.fab:active {
  transform: translateX(calc(240px - var(--space-lg))) scale(0.95);
}

@media (max-width: 512px) {
  .fab {
    right: var(--space-lg);
    transform: none;
  }
  .fab:active {
    transform: scale(0.95);
  }
}

/* Loading spinner */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin: var(--space-xl) auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error */
.error-message {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-danger);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-muted);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-text);
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-full);
  font-size: 14px;
  z-index: 200;
  animation: fadeIn 0.15s ease;
}

/* Label */
.label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: var(--space-xs);
}

/* Amount helpers */
.amount-positive {
  color: var(--color-success);
  font-weight: 600;
}

.amount-negative {
  color: var(--color-danger);
  font-weight: 600;
}

.amount-neutral {
  color: var(--color-text-muted);
  font-weight: 600;
}

/* Select */
.select {
  width: 100%;
  padding: 12px var(--space-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-family: inherit;
  background: var(--color-surface);
  cursor: pointer;
}

.select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Dropdown menu items */
.menu-item {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.1s;
}

.menu-item:hover {
  background: var(--color-bg);
}

.menu-item + .menu-item {
  border-top: 1px solid var(--color-border);
}
```

### src/lib/supabase.js
```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured =
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'your_supabase_url_here' &&
  supabaseKey !== 'your_supabase_anon_key_here'

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseConfigured = () => isConfigured
```

### src/lib/deviceId.js
```js
const STORAGE_KEY = 'splitspend_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
```

### src/lib/emojis.js
```js
export const EMOJI_OPTIONS = [
  '\u{1f600}', '\u{1f60e}', '\u{1f913}', '\u{1f973}', '\u{1f607}',
  '\u{1f98a}', '\u{1f431}', '\u{1f436}', '\u{1f43c}', '\u{1f981}',
  '\u{1f31f}', '\u{1f525}', '\u{1f48e}', '\u{1f3af}', '\u{1f680}',
  '\u{1f3a8}', '\u{1f3b5}', '\u{1f308}', '\u{1f355}', '\u{2615}',
]

export function getRandomEmoji(usedEmojis = []) {
  const available = EMOJI_OPTIONS.filter(e => !usedEmojis.includes(e))
  if (available.length === 0) return EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)]
  return available[Math.floor(Math.random() * available.length)]
}
```

### src/lib/settlement.js
```js
/**
 * Calculate optimized settlements (who pays whom) from expense data.
 * Uses greedy matching of max creditor with max debtor to minimize transactions.
 *
 * @param {Array} participants - [{ id, name }]
 * @param {Array} expenses - [{ id, amount, paid_by, splits: [{ participant_id, share_amount }] }]
 * @returns {{ balances: Object, settlements: Array }}
 */
export function calculateSettlements(participants, expenses) {
  const netBalance = {}

  for (const p of participants) {
    netBalance[p.id] = 0
  }

  for (const expense of expenses) {
    netBalance[expense.paid_by] += Number(expense.amount)

    for (const split of expense.splits) {
      netBalance[split.participant_id] -= Number(split.share_amount)
    }
  }

  // Separate into creditors and debtors
  const creditors = []
  const debtors = []

  for (const [id, balance] of Object.entries(netBalance)) {
    if (balance > 0.01) {
      creditors.push({ id, amount: balance })
    } else if (balance < -0.01) {
      debtors.push({ id, amount: -balance })
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  // Greedy matching
  const settlements = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const transferAmount = Math.min(creditors[i].amount, debtors[j].amount)

    settlements.push({
      from: debtors[j].id,
      to: creditors[i].id,
      amount: Math.round(transferAmount * 100) / 100,
    })

    creditors[i].amount -= transferAmount
    debtors[j].amount -= transferAmount

    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return { balances: netBalance, settlements }
}
```

### src/lib/exportData.js
```js
import { calculateSettlements } from './settlement'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export function exportTripToCSV(trip, participants, expenses, settlementRecords) {
  const symbol = CURRENCY_SYMBOLS[trip.currency] || trip.currency || ''
  const getName = (id) => participants.find(p => p.id === id)?.name || 'Unknown'

  const lines = []

  // Header
  lines.push(`Splitspend Export: ${trip.name}`)
  lines.push(`Currency: ${trip.currency}`)
  lines.push(`Created: ${new Date(trip.created_at).toLocaleDateString()}`)
  lines.push(`Exported: ${new Date().toLocaleDateString()}`)
  lines.push('')

  // Participants
  lines.push('PARTICIPANTS')
  lines.push('Name')
  for (const p of participants) {
    lines.push(csvEscape(p.name))
  }
  lines.push('')

  // Expenses
  lines.push('EXPENSES')
  lines.push('Description,Amount,Paid By,Split Among,Date')
  for (const exp of expenses) {
    const payer = getName(exp.paid_by)
    const splitNames = exp.splits
      .map(s => getName(s.participant_id))
      .join('; ')
    const date = new Date(exp.created_at).toLocaleDateString()
    lines.push(`${csvEscape(exp.description)},${symbol}${Number(exp.amount).toFixed(2)},${csvEscape(payer)},${csvEscape(splitNames)},${date}`)
  }
  lines.push('')

  // Balances
  const { balances, settlements } = calculateSettlements(participants, expenses)
  lines.push('NET BALANCES')
  lines.push('Name,Balance')
  for (const p of participants) {
    const bal = Math.round((balances[p.id] || 0) * 100) / 100
    let label
    if (bal > 0.01) label = `gets back ${symbol}${bal.toFixed(2)}`
    else if (bal < -0.01) label = `owes ${symbol}${Math.abs(bal).toFixed(2)}`
    else label = 'settled'
    lines.push(`${csvEscape(p.name)},${label}`)
  }
  lines.push('')

  // Settlements needed
  lines.push('SETTLEMENTS NEEDED')
  lines.push('From,To,Amount')
  for (const s of settlements) {
    lines.push(`${csvEscape(getName(s.from))},${csvEscape(getName(s.to))},${symbol}${s.amount.toFixed(2)}`)
  }
  lines.push('')

  // Settlement records
  if (settlementRecords.length > 0) {
    lines.push('SETTLEMENT HISTORY')
    lines.push('From,To,Amount,Date')
    for (const rec of settlementRecords) {
      const date = new Date(rec.settled_at).toLocaleDateString()
      lines.push(`${csvEscape(getName(rec.from_participant))},${csvEscape(getName(rec.to_participant))},${symbol}${Number(rec.amount).toFixed(2)},${date}`)
    }
  }

  return lines.join('\n')
}

function csvEscape(str) {
  if (!str) return ''
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### src/store/tripStore.js
```js
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'

const useTripStore = create((set, get) => ({
  trip: null,
  participants: [],
  expenses: [],
  settlementRecords: [],
  myIdentity: null,
  loading: true,
  error: null,

  fetchTrip: async (tripId) => {
    if (!supabase) {
      set({ error: 'Supabase not configured', loading: false })
      return
    }
    set({ loading: true, error: null })
    try {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      if (tripError) throw tripError

      const { data: participants, error: partError } = await supabase
        .from('participants')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at')

      if (partError) throw partError

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('*, splits:expense_splits(*)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })

      if (expError) throw expError

      const { data: settlementRecords, error: settleError } = await supabase
        .from('settlement_records')
        .select('*')
        .eq('trip_id', tripId)
        .order('settled_at', { ascending: false })

      if (settleError) throw settleError

      // Load identity from localStorage
      let savedIdentity = localStorage.getItem(`splitspend_identity_${tripId}`)

      // Device-id recovery: if no per-trip identity, check if device_id matches a claimed participant
      if (!savedIdentity) {
        const deviceId = getDeviceId()
        const matched = participants.find(p => p.claimed_by === deviceId)
        if (matched) {
          savedIdentity = matched.id
          localStorage.setItem(`splitspend_identity_${tripId}`, matched.id)
        }
      }

      set({
        trip,
        participants,
        expenses,
        settlementRecords: settlementRecords || [],
        myIdentity: savedIdentity,
        loading: false,
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  createTrip: async (name, currency, participantData, creatorIndex) => {
    if (!supabase) throw new Error('Supabase not configured. Add your credentials to .env')

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({ name, currency })
      .select()
      .single()

    if (tripError) throw tripError

    const participantRows = participantData.map((p) => ({
      trip_id: trip.id,
      name: p.name,
      emoji: p.emoji || '',
    }))

    const { data: participants, error: partError } = await supabase
      .from('participants')
      .insert(participantRows)
      .select()

    if (partError) throw partError

    // Set the creator
    const creatorId = participants[creatorIndex]?.id || participants[0].id

    // Mark creator as claimed with device_id
    const deviceId = getDeviceId()
    await supabase
      .from('participants')
      .update({ claimed_by: deviceId })
      .eq('id', creatorId)

    // Update trip with creator_id
    await supabase
      .from('trips')
      .update({ creator_id: creatorId })
      .eq('id', trip.id)

    localStorage.setItem(`splitspend_identity_${trip.id}`, creatorId)
    localStorage.setItem(`splitspend_creator_${trip.id}`, 'true')

    set({
      trip: { ...trip, creator_id: creatorId },
      participants: participants.map(p =>
        p.id === creatorId ? { ...p, claimed_by: deviceId } : p
      ),
      expenses: [],
      settlementRecords: [],
      myIdentity: creatorId,
      loading: false,
    })
    return trip.id
  },

  addExpense: async (tripId, description, amount, paidBy, splitAmong) => {
    if (!supabase) throw new Error('Supabase not configured')

    const shareAmount = Math.floor((amount * 100) / splitAmong.length) / 100
    const remainder = Math.round((amount - shareAmount * splitAmong.length) * 100) / 100

    const splits = splitAmong.map((participantId, idx) => ({
      participant_id: participantId,
      share_amount: idx === 0 ? shareAmount + remainder : shareAmount,
    }))

    const { data: expenseId, error } = await supabase.rpc('add_expense', {
      p_trip_id: tripId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_splits: splits,
    })

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  updateExpense: async (expenseId, tripId, description, amount, paidBy, splitAmong) => {
    if (!supabase) throw new Error('Supabase not configured')

    const shareAmount = Math.floor((amount * 100) / splitAmong.length) / 100
    const remainder = Math.round((amount - shareAmount * splitAmong.length) * 100) / 100

    const splits = splitAmong.map((participantId, idx) => ({
      participant_id: participantId,
      share_amount: idx === 0 ? shareAmount + remainder : shareAmount,
    }))

    const { error } = await supabase.rpc('update_expense', {
      p_expense_id: expenseId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_splits: splits,
    })

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  deleteExpense: async (expenseId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  recordSettlement: async (tripId, fromId, toId, amount) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('settlement_records')
      .insert({
        trip_id: tripId,
        from_participant: fromId,
        to_participant: toId,
        amount,
      })

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  undoSettlement: async (settlementId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('settlement_records')
      .delete()
      .eq('id', settlementId)

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  addParticipant: async (tripId, name, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase
      .from('participants')
      .insert({ trip_id: tripId, name, emoji: emoji || '' })
      .select()
      .single()

    if (error) throw error
    await get().fetchTrip(tripId)
    return data
  },

  claimIdentity: async (tripId, participantId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const deviceId = getDeviceId()
    await supabase
      .from('participants')
      .update({ claimed_by: deviceId })
      .eq('id', participantId)

    localStorage.setItem(`splitspend_identity_${tripId}`, participantId)
    set({ myIdentity: participantId })
  },

  updateParticipantEmoji: async (participantId, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('participants')
      .update({ emoji })
      .eq('id', participantId)

    if (error) throw error

    set((state) => ({
      participants: state.participants.map(p =>
        p.id === participantId ? { ...p, emoji } : p
      ),
    }))
  },

  setIdentity: (tripId, participantId) => {
    localStorage.setItem(`splitspend_identity_${tripId}`, participantId)
    set({ myIdentity: participantId })
  },

  isCreator: () => {
    const { trip, myIdentity } = get()
    return trip?.creator_id === myIdentity
  },

  reset: () => {
    set({
      trip: null,
      participants: [],
      expenses: [],
      settlementRecords: [],
      myIdentity: null,
      loading: true,
      error: null,
    })
  },
}))

export default useTripStore
```

### src/hooks/useTrip.js
```js
import { useEffect } from 'react'
import useTripStore from '../store/tripStore'

export default function useTrip(tripId) {
  const fetchTrip = useTripStore((s) => s.fetchTrip)
  const currentTripId = useTripStore((s) => s.trip?.id)

  useEffect(() => {
    if (tripId && tripId !== currentTripId) {
      fetchTrip(tripId)
    }
  }, [tripId, currentTripId, fetchTrip])
}
```

### src/hooks/useRealtime.js
```js
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useTripStore from '../store/tripStore'

export default function useRealtime(tripId) {
  const fetchTrip = useTripStore((s) => s.fetchTrip)

  useEffect(() => {
    if (!tripId || !supabase) return

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlement_records', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, fetchTrip])
}
```

### src/pages/HomePage.jsx
```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import { isSupabaseConfigured } from '../lib/supabase'
import CreateTripForm from '../components/CreateTripForm'

export default function HomePage() {
  const navigate = useNavigate()
  const createTrip = useTripStore((s) => s.createTrip)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async (name, currency, participants, creatorIndex) => {
    setLoading(true)
    setError(null)
    try {
      const tripId = await createTrip(name, currency, participants, creatorIndex)
      navigate(`/trip/${tripId}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img
          src="/favicon.svg"
          alt="Splitspend"
          style={{ width: 56, height: 56, marginBottom: 12, borderRadius: 12 }}
        />
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Splitspend
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
          Split expenses, not friendships.
        </p>
      </div>

      {!isSupabaseConfigured() && (
        <div style={{
          background: 'var(--color-danger-light)',
          border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          marginBottom: 20,
          fontSize: 14,
        }}>
          <strong>Setup required:</strong> Add your Supabase credentials to the{' '}
          <code>.env</code> file. See <code>supabase-schema.sql</code> for the database schema.
        </div>
      )}

      <CreateTripForm onSubmit={handleCreate} loading={loading} />

      {error && (
        <p style={{ color: 'var(--color-danger)', textAlign: 'center', marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  )
}
```

### src/pages/TripPage.jsx
```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'
import useRealtime from '../hooks/useRealtime'
import ExpenseList from '../components/ExpenseList'
import BalanceSummary from '../components/BalanceSummary'
import SettlementList from '../components/SettlementList'
import AddExpenseModal from '../components/AddExpenseModal'
import AddParticipantModal from '../components/AddParticipantModal'
import QRCodeDisplay from '../components/QRCodeDisplay'
import ExportModal from '../components/ExportModal'
import AboutModal from '../components/AboutModal'

export default function TripPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = useTripStore((s) => s.trip)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const isCreator = useTripStore((s) => s.isCreator)

  const [activeTab, setActiveTab] = useState('expenses')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useTrip(tripId)
  useRealtime(tripId)

  // Redirect to join page if no identity set
  useEffect(() => {
    if (!loading && trip && !myIdentity) {
      navigate(`/trip/${tripId}/join`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  // Show QR on first visit (when coming from trip creation)
  useEffect(() => {
    const shown = sessionStorage.getItem(`splitspend_qr_shown_${tripId}`)
    if (!loading && trip && myIdentity && !shown) {
      setShowQR(true)
      sessionStorage.setItem(`splitspend_qr_shown_${tripId}`, '1')
    }
  }, [loading, trip, myIdentity, tripId])

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showMenu])

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="error-message">
          <p style={{ fontSize: 20, marginBottom: 8 }}>Not found</p>
          <p>This link may be invalid or the data may have been deleted.</p>
        </div>
      </div>
    )
  }

  const creator = isCreator()

  const handleEdit = (expense) => {
    setEditingExpense(expense)
  }

  const handleCloseExpenseModal = () => {
    setShowAddExpense(false)
    setEditingExpense(null)
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '8px 0',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{trip.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 14 }}
            onClick={() => setShowQR(true)}
          >
            Share
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn-ghost"
              style={{ fontSize: 22, padding: '4px 8px', lineHeight: 1 }}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              title="More options"
            >
              &#8942;
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-modal)',
                zIndex: 60,
                minWidth: 180,
                overflow: 'hidden',
              }}>
                <button
                  className="menu-item"
                  onClick={() => { window.open(window.location.origin, '_blank'); setShowMenu(false) }}
                >
                  New Splitspend
                </button>
                {creator && (
                  <button
                    className="menu-item"
                    onClick={() => { setShowAddParticipant(true); setShowMenu(false) }}
                  >
                    Add Participant
                  </button>
                )}
                <button
                  className="menu-item"
                  onClick={() => { setShowExport(true); setShowMenu(false) }}
                >
                  Export Data
                </button>
                <button
                  className="menu-item"
                  onClick={() => { setShowAbout(true); setShowMenu(false) }}
                >
                  About Splitspend
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button
          className={`tab ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Balances
        </button>
        <button
          className={`tab ${activeTab === 'settle' ? 'active' : ''}`}
          onClick={() => setActiveTab('settle')}
        >
          Settle
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'expenses' && <ExpenseList onEdit={handleEdit} />}
      {activeTab === 'balances' && <BalanceSummary />}
      {activeTab === 'settle' && <SettlementList />}

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddExpense(true)}>
        +
      </button>

      {/* Modals */}
      {(showAddExpense || editingExpense) && (
        <AddExpenseModal
          onClose={handleCloseExpenseModal}
          expense={editingExpense}
        />
      )}
      {showQR && (
        <QRCodeDisplay tripId={tripId} onClose={() => setShowQR(false)} />
      )}
      {showAddParticipant && (
        <AddParticipantModal onClose={() => setShowAddParticipant(false)} />
      )}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  )
}
```

### src/pages/JoinPage.jsx
```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'
import { EMOJI_OPTIONS } from '../lib/emojis'

export default function JoinPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const claimIdentity = useTripStore((s) => s.claimIdentity)
  const updateParticipantEmoji = useTripStore((s) => s.updateParticipantEmoji)

  const [selectedId, setSelectedId] = useState(null)
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [joining, setJoining] = useState(false)

  useTrip(tripId)

  // Redirect returning users who already have an identity
  useEffect(() => {
    if (!loading && trip && myIdentity) {
      navigate(`/trip/${tripId}`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  // Filter out already-claimed participants
  const unclaimedParticipants = participants.filter((p) => !p.claimed_by)
  const claimedParticipants = participants.filter((p) => p.claimed_by)

  const handleTap = (participant) => {
    if (selectedId === participant.id) {
      setSelectedId(null)
      setSelectedEmoji(null)
    } else {
      setSelectedId(participant.id)
      setSelectedEmoji(participant.emoji || EMOJI_OPTIONS[0])
    }
  }

  const handleConfirm = async () => {
    if (!selectedId) return
    setJoining(true)
    try {
      const participant = participants.find(p => p.id === selectedId)
      if (selectedEmoji && selectedEmoji !== participant?.emoji) {
        await updateParticipantEmoji(selectedId, selectedEmoji)
      }
      await claimIdentity(tripId, selectedId)
      navigate(`/trip/${tripId}`)
    } catch {
      setJoining(false)
    }
  }

  const handleRejoin = async (participant) => {
    setJoining(true)
    try {
      await claimIdentity(tripId, participant.id)
      navigate(`/trip/${tripId}`)
    } catch {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="error-message">
          <p style={{ fontSize: 20, marginBottom: 8 }}>Not found</p>
          <p>This link may be invalid or the data may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Splitspend
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {trip.name}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
          Who are you?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {unclaimedParticipants.length === 0 && claimedParticipants.length > 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 18, marginBottom: 8 }}>All identities have been claimed</p>
            <p>If you were already part of this group, tap your name below to rejoin.</p>
          </div>
        ) : (
          unclaimedParticipants.map((p) => (
            <div key={p.id}>
              <button
                className="card"
                onClick={() => handleTap(p)}
                style={{
                  border: selectedId === p.id
                    ? '2px solid var(--color-primary)'
                    : '2px solid var(--color-border)',
                  background: selectedId === p.id
                    ? 'var(--color-primary-light)'
                    : 'var(--color-surface)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: 600,
                  padding: '20px',
                  transition: 'border-color 0.15s, background 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  width: '100%',
                  borderRadius: selectedId === p.id
                    ? 'var(--radius-md) var(--radius-md) 0 0'
                    : 'var(--radius-md)',
                }}
              >
                {p.emoji && <span style={{ fontSize: 24 }}>{p.emoji}</span>}
                {p.name}
              </button>

              {selectedId === p.id && (
                <div style={{
                  border: '2px solid var(--color-primary)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  padding: 16,
                  background: 'var(--color-surface)',
                }}>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textAlign: 'center' }}>
                    Pick your emoji
                  </p>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setSelectedEmoji(emoji)}
                        style={{
                          background: selectedEmoji === emoji ? 'var(--color-primary-light)' : 'none',
                          border: selectedEmoji === emoji
                            ? '2px solid var(--color-primary)'
                            : '2px solid transparent',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: 22,
                          padding: 5,
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={joining}
                    style={{ width: '100%' }}
                  >
                    {joining ? 'Joining...' : `Join as ${selectedEmoji || ''} ${p.name}`}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Show claimed participants with rejoin option */}
      {claimedParticipants.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, textAlign: 'center' }}>
            Already joined:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {claimedParticipants.map(p => (
              <div
                key={p.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  opacity: 0.8,
                }}
              >
                <span style={{ fontSize: 15 }}>
                  {p.emoji && <span style={{ marginRight: 6 }}>{p.emoji}</span>}
                  {p.name}
                </span>
                <button
                  className="btn-ghost"
                  onClick={() => handleRejoin(p)}
                  disabled={joining}
                  style={{
                    fontSize: 13,
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    padding: '4px 10px',
                  }}
                >
                  This is me
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

### src/components/CreateTripForm.jsx
```jsx
import { useState } from 'react'
import { EMOJI_OPTIONS, getRandomEmoji } from '../lib/emojis'

const CURRENCIES = [
  { code: 'INR', symbol: '\u20b9', label: 'INR (\u20b9)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '\u20ac', label: 'EUR (\u20ac)' },
  { code: 'GBP', symbol: '\u00a3', label: 'GBP (\u00a3)' },
]

export default function CreateTripForm({ onSubmit, loading }) {
  const [tripName, setTripName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [participantName, setParticipantName] = useState('')
  // participants: [{ name, emoji }]
  const [participants, setParticipants] = useState([])
  const [creatorIndex, setCreatorIndex] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null) // index of participant

  const usedEmojis = participants.map(p => p.emoji)

  const addParticipant = () => {
    const name = participantName.trim()
    if (!name) return
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) return
    const emoji = getRandomEmoji(usedEmojis)
    setParticipants([...participants, { name, emoji }])
    setParticipantName('')
  }

  const removeParticipant = (index) => {
    const next = participants.filter((_, i) => i !== index)
    setParticipants(next)
    // Adjust creatorIndex if needed
    if (creatorIndex >= next.length) {
      setCreatorIndex(Math.max(0, next.length - 1))
    } else if (creatorIndex > index) {
      setCreatorIndex(creatorIndex - 1)
    }
  }

  const setEmoji = (index, emoji) => {
    setParticipants(participants.map((p, i) => i === index ? { ...p, emoji } : p))
    setShowEmojiPicker(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addParticipant()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tripName.trim() || participants.length < 2) return
    onSubmit(tripName.trim(), currency, participants, creatorIndex)
  }

  const canSubmit = tripName.trim() && participants.length >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          placeholder="e.g. Goa Trip, Flat Expenses, Dinner"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">Currency</label>
        <select
          className="select"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Participants ({participants.length})</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: participants.length ? 12 : 0 }}>
          <input
            className="input"
            placeholder="Add a name"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addParticipant}
            disabled={!participantName.trim()}
            style={{ width: 'auto', padding: '12px 16px' }}
          >
            Add
          </button>
        </div>

        {participants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {participants.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div
                  className="chip"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: creatorIndex === i ? 'var(--color-primary-light)' : undefined,
                    border: creatorIndex === i ? '2px solid var(--color-primary)' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === i ? null : i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 20,
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Change emoji"
                    >
                      {p.emoji}
                    </button>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    {creatorIndex === i && (
                      <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>YOU</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {creatorIndex !== i && (
                      <button
                        type="button"
                        onClick={() => setCreatorIndex(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          padding: '2px 6px',
                        }}
                        title="This is me"
                      >
                        This is me
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeParticipant(i)}
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {showEmojiPicker === i && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    boxShadow: 'var(--shadow-modal)',
                    marginTop: 4,
                  }}>
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEmoji(i, emoji)}
                        style={{
                          background: p.emoji === emoji ? 'var(--color-primary-light)' : 'none',
                          border: p.emoji === emoji ? '2px solid var(--color-primary)' : '2px solid transparent',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: 20,
                          padding: 4,
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {participants.length < 2 && participants.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Add at least 2 participants
          </p>
        )}

        {participants.length >= 2 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Tag yourself by clicking "This is me" next to your name
          </p>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {loading ? 'Creating...' : 'Create Splitspend'}
      </button>
    </form>
  )
}
```

### src/components/AddExpenseModal.jsx
```jsx
import { useState } from 'react'
import useTripStore from '../store/tripStore'

export default function AddExpenseModal({ onClose, expense }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const addExpense = useTripStore((s) => s.addExpense)
  const updateExpense = useTripStore((s) => s.updateExpense)

  const isEdit = !!expense

  const [description, setDescription] = useState(isEdit ? expense.description : '')
  const [amount, setAmount] = useState(isEdit ? String(expense.amount) : '')
  const [paidBy, setPaidBy] = useState(isEdit ? expense.paid_by : (participants[0]?.id || ''))
  const [splitAll, setSplitAll] = useState(
    isEdit ? expense.splits.length === participants.length : true
  )
  const [splitAmong, setSplitAmong] = useState(
    isEdit ? expense.splits.map((s) => s.participant_id) : participants.map((p) => p.id)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const toggleParticipant = (id) => {
    if (splitAmong.includes(id)) {
      const next = splitAmong.filter((pid) => pid !== id)
      if (next.length === 0) return
      setSplitAmong(next)
      setSplitAll(next.length === participants.length)
    } else {
      const next = [...splitAmong, id]
      setSplitAmong(next)
      setSplitAll(next.length === participants.length)
    }
  }

  const toggleAll = () => {
    if (splitAll) {
      setSplitAll(false)
    } else {
      setSplitAll(true)
      setSplitAmong(participants.map((p) => p.id))
    }
  }

  const parsedAmount = parseFloat(amount)
  const canSubmit = description.trim() && parsedAmount > 0 && paidBy && splitAmong.length > 0 && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await updateExpense(expense.id, trip.id, description.trim(), parsedAmount, paidBy, splitAmong)
      } else {
        await addExpense(trip.id, description.trim(), parsedAmount, paidBy, splitAmong)
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="e.g. Dinner, Taxi, Hotel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Amount</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Paid by</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  style={paidBy === p.id ? {
                    background: 'var(--color-primary)',
                    color: 'white',
                    cursor: 'pointer',
                    border: 'none',
                  } : {
                    background: 'var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                  onClick={() => setPaidBy(p.id)}
                >
                  {p.emoji || ''} {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Split among</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={splitAll}
                onChange={toggleAll}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Everyone equally</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {participants.map((p) => {
                const selected = splitAmong.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    style={selected ? {
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      border: '2px solid var(--color-primary)',
                    } : {
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      border: '2px solid var(--color-border)',
                    }}
                    onClick={() => toggleParticipant(p.id)}
                  >
                    {p.emoji || ''} {p.name}
                  </button>
                )
              })}
            </div>
            {parsedAmount > 0 && splitAmong.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
                {splitAmong.length === 1
                  ? `${participants.find(p => p.id === splitAmong[0])?.name} pays full amount`
                  : `Split: ${(parsedAmount / splitAmong.length).toFixed(2)} each`
                }
              </p>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {loading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add Expense')}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### src/components/ExpenseCard.jsx
```jsx
import useTripStore from '../store/tripStore'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function ExpenseCard({ expense, onDelete, onEdit }) {
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  const payer = participants.find((p) => p.id === expense.paid_by)
  const splitNames = expense.splits
    .map((s) => {
      const p = participants.find((p) => p.id === s.participant_id)
      return p ? `${p.emoji || ''} ${p.name}`.trim() : null
    })
    .filter(Boolean)

  const splitLabel =
    splitNames.length === participants.length
      ? `Everyone (${splitNames.length})`
      : splitNames.join(', ')

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
          {expense.description}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Paid by {payer?.emoji || ''} {payer?.name || 'Unknown'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Split: {splitLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          {symbol}{Number(expense.amount).toLocaleString()}
        </span>
        {onEdit && (
          <button
            className="btn-ghost"
            onClick={() => onEdit(expense)}
            style={{ fontSize: 15, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Edit expense"
          >
            &#9998;
          </button>
        )}
        {onDelete && (
          <button
            className="btn-ghost"
            onClick={() => onDelete(expense.id)}
            style={{ fontSize: 18, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Delete expense"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
```

### src/components/ExpenseList.jsx
```jsx
import useTripStore from '../store/tripStore'
import ExpenseCard from './ExpenseCard'

export default function ExpenseList({ onEdit }) {
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const deleteExpense = useTripStore((s) => s.deleteExpense)

  const handleDelete = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await deleteExpense(expenseId, trip.id)
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 36, marginBottom: 8 }}>No expenses yet</p>
        <p>Tap + to add your first expense</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {expenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          onDelete={handleDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}
```

### src/components/BalanceSummary.jsx
```jsx
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function BalanceSummary() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to calculate balances</p>
      </div>
    )
  }

  const { balances } = calculateSettlements(participants, expenses)

  // Calculate total trip spend
  const totalSpend = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Spend</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{symbol}{totalSpend.toLocaleString()}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
          Net Balances
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {participants.map((p) => {
            const balance = balances[p.id] || 0
            const rounded = Math.round(balance * 100) / 100
            let className = 'amount-neutral'
            let label = 'settled'
            if (rounded > 0.01) {
              className = 'amount-positive'
              label = `gets back ${symbol}${rounded.toLocaleString()}`
            } else if (rounded < -0.01) {
              className = 'amount-negative'
              label = `owes ${symbol}${Math.abs(rounded).toLocaleString()}`
            }

            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{p.emoji || ''} {p.name}</span>
                <span className={className}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

### src/components/SettlementList.jsx
```jsx
import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function SettlementList() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const recordSettlement = useTripStore((s) => s.recordSettlement)
  const undoSettlement = useTripStore((s) => s.undoSettlement)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  const [settling, setSettling] = useState(null) // "from-to" key of settlement being recorded

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to settle</p>
      </div>
    )
  }

  const { settlements } = calculateSettlements(participants, expenses)

  const getName = (id) => participants.find((p) => p.id === id)?.name || 'Unknown'
  const getEmoji = (id) => participants.find((p) => p.id === id)?.emoji || ''

  // Calculate how much has already been settled between each pair
  const settledAmounts = {}
  for (const rec of settlementRecords) {
    const key = `${rec.from_participant}-${rec.to_participant}`
    settledAmounts[key] = (settledAmounts[key] || 0) + Number(rec.amount)
  }

  // Compute remaining settlements after accounting for recorded payments
  const remainingSettlements = settlements.map((s) => {
    const key = `${s.from}-${s.to}`
    const settled = settledAmounts[key] || 0
    const remaining = Math.round((s.amount - settled) * 100) / 100
    return { ...s, settled, remaining }
  }).filter(s => s.remaining > 0.01)

  const fullySettled = settlements.filter((s) => {
    const key = `${s.from}-${s.to}`
    const settled = settledAmounts[key] || 0
    return settled >= s.amount - 0.01
  })

  const handleSettle = async (s) => {
    const key = `${s.from}-${s.to}`
    setSettling(key)
    try {
      await recordSettlement(trip.id, s.from, s.to, s.remaining)
    } catch (err) {
      alert('Failed to record settlement: ' + err.message)
    }
    setSettling(null)
  }

  const handleUndoSettlement = async (recordId) => {
    if (!window.confirm('Undo this settlement?')) return
    try {
      await undoSettlement(recordId, trip.id)
    } catch (err) {
      alert('Failed to undo: ' + err.message)
    }
  }

  const allSettled = remainingSettlements.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {allSettled && settlements.length > 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
          <p>All payments have been recorded</p>
        </div>
      ) : remainingSettlements.length > 0 ? (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Payments to Settle ({remainingSettlements.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {remainingSettlements.map((s, i) => {
              const key = `${s.from}-${s.to}`
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < remainingSettlements.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.from)} {getName(s.from)}</span>
                      <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>pays</span>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.to)} {getName(s.to)}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      {symbol}{s.remaining.toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
                    onClick={() => handleSettle(s)}
                    disabled={settling === key}
                  >
                    {settling === key ? 'Recording...' : 'Mark as Settled'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
          <p>No payments needed</p>
        </div>
      )}

      {/* Settlement history */}
      {settlementRecords.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Settlement History ({settlementRecords.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {settlementRecords.map((rec) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {getEmoji(rec.from_participant)} {getName(rec.from_participant)}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', margin: '0 6px', fontSize: 13 }}>paid</span>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {getEmoji(rec.to_participant)} {getName(rec.to_participant)}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)', marginLeft: 8, fontSize: 14 }}>
                    {symbol}{Number(rec.amount).toLocaleString()}
                  </span>
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => handleUndoSettlement(rec.id)}
                  style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '4px 8px' }}
                  title="Undo settlement"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

### src/components/AddParticipantModal.jsx
```jsx
import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { EMOJI_OPTIONS, getRandomEmoji } from '../lib/emojis'

export default function AddParticipantModal({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const addParticipant = useTripStore((s) => s.addParticipant)

  const usedEmojis = participants.map(p => p.emoji)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(getRandomEmoji(usedEmojis))
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (participants.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A participant with this name already exists')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await addParticipant(trip.id, trimmed, emoji)
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Participant</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Emoji</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  background: 'var(--color-bg)',
                  border: '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 28,
                  padding: '8px 16px',
                  lineHeight: 1,
                }}
              >
                {emoji}
              </button>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                Tap to change
              </span>
            </div>
            {showEmojiPicker && (
              <div style={{
                marginTop: 8,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
              }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                    style={{
                      background: emoji === e ? 'var(--color-primary-light)' : 'none',
                      border: emoji === e ? '2px solid var(--color-primary)' : '2px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: 20,
                      padding: 4,
                      lineHeight: 1,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading}>
            {loading ? 'Adding...' : 'Add Participant'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### src/components/QRCodeDisplay.jsx
```jsx
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeDisplay({ tripId, onClose }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/trip/${tripId}/join`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareLink = async () => {
    try {
      await navigator.share({ url, title: 'Join my Splitspend' })
    } catch {
      // Share cancelled or not supported
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Share</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
          Others can scan this QR code to join and view expenses
        </p>

        <div style={{
          display: 'inline-block',
          padding: 16,
          background: 'white',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
        }}>
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <p style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          wordBreak: 'break-all',
          marginBottom: 20,
          padding: '8px 12px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {url}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button className="btn btn-secondary" onClick={shareLink}>
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### src/components/ExportModal.jsx
```jsx
import useTripStore from '../store/tripStore'
import { exportTripToCSV, downloadCSV } from '../lib/exportData'

export default function ExportModal({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const settlementRecords = useTripStore((s) => s.settlementRecords)

  const handleExportCSV = () => {
    const csv = exportTripToCSV(trip, participants, expenses, settlementRecords)
    const filename = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_splitspend.csv`
    downloadCSV(csv, filename)
  }

  const handleExportJSON = () => {
    const data = {
      trip: {
        name: trip.name,
        currency: trip.currency,
        created_at: trip.created_at,
      },
      participants: participants.map(p => ({
        name: p.name,
      })),
      expenses: expenses.map(exp => ({
        description: exp.description,
        amount: Number(exp.amount),
        paid_by: participants.find(p => p.id === exp.paid_by)?.name || 'Unknown',
        split_among: exp.splits.map(s => ({
          name: participants.find(p => p.id === s.participant_id)?.name || 'Unknown',
          share: Number(s.share_amount),
        })),
        date: exp.created_at,
      })),
      settlement_records: settlementRecords.map(rec => ({
        from: participants.find(p => p.id === rec.from_participant)?.name || 'Unknown',
        to: participants.find(p => p.id === rec.to_participant)?.name || 'Unknown',
        amount: Number(rec.amount),
        date: rec.settled_at,
      })),
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_splitspend.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Export Data</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
          Download all expenses, balances, and settlement records for "{trip.name}"
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            Export as CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportJSON}>
            Export as JSON
          </button>
        </div>
      </div>
    </div>
  )
}
```

### src/components/AboutModal.jsx
```jsx
export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>About</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Splitspend
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Split expenses, not friendships.
          </p>
        </div>

        <div style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          marginBottom: 16,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          <p style={{ marginBottom: 8 }}>
            No accounts. No logins. Just share a link and split expenses with friends.
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your data lives as long as the link does. Export anytime to keep a local copy.
          </p>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Created by <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Ritwik Balo</span>
        </p>
      </div>
    </div>
  )
}
```

---

## Deployment

### Supabase Setup
1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor > New Query
3. Paste and run `supabase-schema.sql` (for fresh setup) or the appropriate migration file
4. For v3: also run `supabase-migration-v3.sql` to add the `update_expense` RPC function
5. Go to Database > Replication and enable realtime for: `expenses`, `expense_splits`, `participants`, `settlement_records`
6. Copy your project URL and anon key from Settings > API into `.env`

### Vercel Deployment
1. From the `splitspend-v3` directory, run: `vercel --prod`
2. The `vercel.json` SPA rewrite handles client-side routing
3. Set environment variables in Vercel dashboard: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Local Development
```bash
cd splitspend-v3
npm install
npm run dev
# Opens at http://localhost:5173
```
