/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { round2 } from './splits'

/**
 * Per-person spending, split into the two numbers that mean different things:
 *
 *   paid  — what actually left this person's pocket (they were the payer)
 *   share — what they consumed (their slice of every expense they're in)
 *
 * paid − share is the pre-settlement net; the settlement-aware net comes from
 * calculateSettlements(), which also folds in recorded payments.
 *
 * @param {Array} participants - [{ id }]
 * @param {Array} expenses - [{ amount, paid_by, splits: [{ participant_id, share_amount }] }]
 * @returns {Object} { [participantId]: { paid, share, expenses: [] } }
 */
export function calculatePersonTotals(participants, expenses) {
  const totals = {}
  for (const p of participants) {
    totals[p.id] = { paid: 0, share: 0, expenses: [] }
  }

  for (const expense of expenses) {
    const payer = totals[expense.paid_by]
    if (payer) {
      payer.paid += Number(expense.amount)
      payer.expenses.push(expense)
    }
    for (const split of expense.splits || []) {
      const person = totals[split.participant_id]
      if (person) person.share += Number(split.share_amount)
    }
  }

  for (const id of Object.keys(totals)) {
    totals[id].paid = round2(totals[id].paid)
    totals[id].share = round2(totals[id].share)
  }

  return totals
}
