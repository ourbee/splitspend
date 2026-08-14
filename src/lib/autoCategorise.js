/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Filling in the labels the Reports tab groups by.
//
// Order of authority, cheapest first:
//   1. A label already stored on the expense — including a hand correction.
//      Never overwritten.
//   2. The offline keyword matcher in categories.js.
//   3. One batched Gemini call for whatever is left.
//
// Steps 1 and 2 cover the overwhelming majority of a real trip, so the network
// is not in the common path at all. Step 3 is one request for the whole trip,
// not one per expense, and its answers are written back to the database so it
// never runs twice over the same descriptions.
//
// Everything the model returns is snapped back onto the fixed taxonomy before
// it is stored. A model that ignores the menu and invents "Fine Dining" gets
// folded into Other rather than becoming a new slice of the donut.

import { TAXONOMY, resolveLabel } from './taxonomy'
import { guessLabelStrings } from './categories'

/** Expenses with no stored category — the only ones worth spending effort on. */
export function unlabelledExpenses(expenses) {
  return expenses.filter((e) => !e.category)
}

/**
 * Label everything that can be labelled without the network.
 * @returns {Array} rows ready for set_expense_labels_v7
 */
export function localLabels(expenses) {
  const rows = []
  for (const expense of unlabelledExpenses(expenses)) {
    const guess = guessLabelStrings(expense.description)
    if (guess.matched) {
      rows.push({ id: expense.id, category: guess.category, subcategory: guess.subcategory })
    }
  }
  return rows
}

/**
 * Ask Gemini to label the descriptions the keyword matcher couldn't place.
 *
 * Resolves to rows ready for set_expense_labels_v7. Throws only on a genuine
 * transport failure — the caller treats that as "leave them unlabelled and
 * try again next time", never as a reason to lose the local labels.
 */
export async function remoteLabels(expenses) {
  const pending = unlabelledExpenses(expenses).filter(
    (e) => !guessLabelStrings(e.description).matched
  )
  if (!pending.length) return []

  const res = await fetch('/api/categorise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: pending.map((e) => ({ id: e.id, text: e.description })),
      // The menu travels with the request so this file stays the only place
      // the taxonomy is defined.
      taxonomy: TAXONOMY.map((c) => ({
        category: c.label,
        subs: c.subs.map((s) => s.label),
      })),
    }),
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `Could not label these expenses (${res.status})`)
  }

  const known = new Set(pending.map((e) => e.id))
  return (body.labels || [])
    .filter((row) => known.has(row.id))
    .map((row) => {
      // The gate: whatever came back is pulled onto the real taxonomy.
      const { category, sub } = resolveLabel(row.category, row.subcategory)
      return { id: row.id, category: category.label, subcategory: sub.label }
    })
}
