# Splitspend

**Split expenses, not friendships.**

A sessionless, no-login expense-splitting web app. Create a group, share a
link or QR code, and everyone can add expenses and see who owes whom — no
accounts, no logins, no app install.

**Live at [splitspend.vercel.app](https://splitspend.vercel.app)**

## How it works

1. Create a group and add participant names.
2. Share the link (or QR code) with the group.
3. Everyone opens the link, taps their own name once, and starts adding
   expenses — split equally or with custom per-person amounts.
4. The app computes net balances and the minimum set of payments to settle
   up, and tracks which payments have actually been made.

## Philosophy

- **No accounts.** Knowing the link *is* the access. Identity is remembered
  per device; reopening the link later just works — and if a device isn't
  recognized (new browser, cleared storage), one tap on
  "Continue as *you*" picks up exactly where you left off.
- **Your data, your export.** Every group can be exported to CSV/JSON, or
  printed as a Trip Diary, at any time.
- **No photo storage.** Bills can be scanned for their text, but the image is
  read once and thrown away — never saved, never attached to an expense.

## Features

- Equal or **unequal splits** (assign exact amounts per person)
- Live sync across everyone's devices (Supabase Realtime broadcast)
- Optimized settle-up suggestions (greedy creditor/debtor matching),
  settlement recording with undo, and balances that always account for
  payments already made
- Expense editing, custom expense dates, and "added by" attribution
- Expenses grouped by day with per-day totals, newest first, and search
  across descriptions, people, amounts and categories
- Per-person breakdown in Balances — **paid** vs **share** vs net, with each
  person's own spends one tap away
- Notes on any expense, with **bill scanning** — photograph a receipt and the
  total, the summary and the **per-item table** (name, quantity, rate, amount)
  are read out of it; the photo itself is never stored or uploaded anywhere
  but the one read. Bill rows are a record only: every balance is worked out
  from the expense amount alone, so a misread receipt can never move what
  somebody owes
- **Reports** — spending by category as a donut you can tap open, with a
  subcategory breakdown underneath. Categories come from a fixed list matched
  offline by keyword first, with one batched model call for the leftovers;
  **the model only ever picks labels, and every figure is summed in the
  browser.** Any expense can be re-categorised by hand
- **Non-expense events** — "Sunset at Anjuna", "Train to Goa" — added from the
  same + button, shown as distinct cards, ignored by all money maths
- **Trip Diary export** — a printable keepsake that opens with the category
  report, then the day-by-day story with notes, bill items and events, and
  closes with an invoice-style statement. Print/PDF, or download it as an
  editable Word document
- Soft per-person colour coding — automatic, or pick your own colour and
  emoji from the name chip; your colour also themes the buttons **on your own
  device only**
- Category icons guessed from the description, overridable per expense
- **Long-press to drag** an expense or event into place within its day
- Emoji avatars, QR-code sharing, multi-currency
- Works entirely in the browser — mobile-first UI

## Tech stack

- **Frontend:** React 19, Vite, React Router 7, Zustand
- **Backend:** Supabase (PostgreSQL). All access goes through
  `SECURITY DEFINER` RPC functions keyed by the group's UUID — the public
  anon key has **no direct table access**.
- **Hosting:** Vercel (SPA + a daily cron keep-alive for the free-tier
  database)

## Development

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm run dev
```

Database setup: run `supabase-schema.sql` in the Supabase SQL editor, then
section 3 of `supabase-migration-v4.sql` (the RPC definitions), then
`supabase-migration-v5.sql`, `supabase-migration-v6.sql` and
`supabase-migration-v7.sql`. Upgrading an existing v2/v3 install: run
`supabase-migration-v4.sql`, `supabase-hardening-v4.sql`, then the v5, v6 and
v7 migrations in order.

Each migration is additive — it adds tables, columns and new functions but
leaves every earlier RPC untouched, so **run it before deploying the matching
frontend**. The previous bundle keeps working while it is in place.

Bill scanning and the Reports tab's category labelling both need
`GEMINI_API_KEY` set as a server-side environment variable (Vercel project
settings, or `.env` locally when running `vercel dev`). Without it every other
feature works normally: the scan button reports that scanning isn't
configured, and Reports falls back to its offline keyword matcher — the chart
and every total still appear, because no figure on that tab was ever coming
from a model. The key is never shipped to the browser; the image and the
descriptions are relayed by `api/scan-receipt.js` and `api/categorise.js`.

## Version history

- **v1** — basic splitting, QR sharing, CSV export
- **v2** — identities ("Who are you?"), emoji avatars, settlement tracking
- **v3** — expense editing, device recognition, neutral language
- **v4** — welcome-back identity flow with multi-device support, unequal
  splits, corrected settlement math, RPC-hardened database, expense dates
  and attribution, in-app confirmations, link previews, keep-alive cron
- **v4.1** — day-grouped expense list with day totals, expense search,
  per-person spend breakdown, per-person colours, category icons, and the
  share sheet now only appears right after a group is created
- **v5** — notes on expenses, pick-your-own person colour and emoji,
  overridable per-expense icons, and long-press drag to arrange a day's
  expenses by hand
- **v6** — non-expense diary events, bill scanning into notes (text only,
  no photo kept), the printable Trip Diary export, your colour theming your
  own interface, yourself listed first and preselected when adding an
  expense, and a firmer lift under a dragged card
- **v7** — bills read down to their individual items, a separate camera and
  gallery choice when scanning (Android pickers often hid the camera behind a
  single file input), the Settle tab folded into Balances where the duplicate
  net-balance card used to be, a new **Reports** tab with a category donut and
  subcategory breakdown, that report leading the Trip Diary, an editable Word
  export, and no URL printed on the exported diary

Created by **Ritwik Balo**.
