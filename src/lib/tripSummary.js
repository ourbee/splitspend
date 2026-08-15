/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// The written paragraph the Trip Diary opens with.
//
// Everything factual is assembled here, in the browser, from the stored trip:
// the day order, the amounts, the category totals. /api/summarise receives that
// finished fact sheet and is asked only to turn it into prose. It is never
// asked to add anything up, and nothing it returns is parsed back into a
// number — the statement and the report are computed as they always were.
//
// No participant name is ever sent. The group travels as a count, and the
// prompt asks for "we", which is what was wanted: a diary, not a ledger with
// adjectives.

import { groupByDay, formatDay } from './dates'
import { sortExpenses } from './expenseOrder'
import { buildReport } from './reportData'
import { currencySymbol } from './currency'
import { round2 } from './splits'

const MIN_WORDS = 120
const MAX_WORDS = 500

/**
 * The facts the summary is written from — oldest day first, because a story
 * runs forwards whatever order the diary itself is set to.
 */
export function buildSummaryFacts(trip, participants, expenses, events) {
  const symbol = currencySymbol(trip?.currency)
  const items = sortExpenses([...expenses, ...events])
  // groupByDay preserves the newest-first order it is given; reversing both
  // the days and each day's contents turns it into a forward narrative.
  const groups = groupByDay(items).slice().reverse()

  const report = buildReport(expenses)

  const days = groups.map((group) => ({
    date: formatDay(group.key),
    spent: group.total > 0 ? round2(group.total) : null,
    entries: group.expenses.slice().reverse().map((item) => {
      if (item._type === 'event') {
        return {
          kind: 'event',
          text: item.title || '',
          amount: null,
          note: item.note || '',
          items: [],
        }
      }
      return {
        kind: 'expense',
        text: item.description || '',
        amount: round2(Number(item.amount) || 0),
        note: item.note || '',
        // Dish names are the best material in the whole trip for a paragraph
        // like this — prices are left behind, only what was on the bill goes.
        items: (item.line_items || []).map((li) => li?.name).filter(Boolean),
      }
    }),
  }))

  const dateRange = groups.length
    ? (groups.length === 1
        ? formatDay(groups[0].key)
        : `${formatDay(groups[0].key)} to ${formatDay(groups[groups.length - 1].key)}`)
    : ''

  return {
    currency: symbol,
    people: participants.length || null,
    total: report.total,
    dateRange,
    categories: report.categories.map((c) => ({ label: c.label, total: c.total })),
    days,
  }
}

/**
 * How long the paragraph should be: a day trip does not need five hundred
 * words, and a fortnight cannot be told in ninety.
 */
export function wordBudget(facts) {
  const entries = facts.days.reduce((n, day) => n + day.entries.length, 0)
  const raw = 100 + facts.days.length * 30 + entries * 4
  return Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(raw / 10) * 10))
}

/**
 * A fingerprint of the facts, so a summary can say whether it still describes
 * the trip it was written from. Not a security hash — two rounds of FNV-1a
 * with different offsets, which is plenty for "has anything changed?".
 */
export function summaryFingerprint(facts) {
  const input = JSON.stringify(facts)
  const rounds = [0x811c9dc5, 0x01000193]
  return rounds
    .map((seed) => {
      let h = seed
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
      }
      return (h >>> 0).toString(16).padStart(8, '0')
    })
    .join('')
}

/** True when the stored summary was written from a different trip than this. */
export function summaryIsStale(trip, facts) {
  if (!trip?.summary) return false
  if (!trip.summary_hash) return false
  return trip.summary_hash !== summaryFingerprint(facts)
}

/**
 * Ask the server for the paragraph. Resolves to the text; throws with a
 * readable message the diary screen can show, since this only ever runs
 * because somebody pressed a button and is waiting for it.
 */
export async function writeSummary(facts) {
  const res = await fetch('/api/summarise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts, words: wordBudget(facts) }),
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok || !body?.ok || !body.summary) {
    throw new Error(body?.error || `Could not write the summary (${res.status})`)
  }

  return body.summary
}
