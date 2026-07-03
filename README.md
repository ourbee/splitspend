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
- **Your data, your export.** Every group can be exported to CSV/JSON at
  any time.

## Features

- Equal or **unequal splits** (assign exact amounts per person)
- Live sync across everyone's devices (Supabase Realtime broadcast)
- Optimized settle-up suggestions (greedy creditor/debtor matching),
  settlement recording with undo, and balances that always account for
  payments already made
- Expense editing, custom expense dates, and "added by" attribution
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
section 3 of `supabase-migration-v4.sql` (the RPC definitions). Upgrading
an existing v2/v3 install: run `supabase-migration-v4.sql` then
`supabase-hardening-v4.sql`.

## Version history

- **v1** — basic splitting, QR sharing, CSV export
- **v2** — identities ("Who are you?"), emoji avatars, settlement tracking
- **v3** — expense editing, device recognition, neutral language
- **v4** — welcome-back identity flow with multi-device support, unequal
  splits, corrected settlement math, RPC-hardened database, expense dates
  and attribution, in-app confirmations, link previews, keep-alive cron

Created by **Ritwik Balo**.
