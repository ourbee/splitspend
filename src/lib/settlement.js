/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

/**
 * Calculate optimized settlements (who pays whom) from expense data.
 * Uses greedy matching of max creditor with max debtor to minimize transactions.
 *
 * Recorded settlements are folded into the net balances as real transfers
 * (payer's balance rises, receiver's falls), so balances and suggested
 * payments stay correct even when new expenses arrive after a settlement.
 *
 * @param {Array} participants - [{ id, name }]
 * @param {Array} expenses - [{ id, amount, paid_by, splits: [{ participant_id, share_amount }] }]
 * @param {Array} settlementRecords - [{ from_participant, to_participant, amount }]
 * @returns {{ balances: Object, settlements: Array }}
 */
export function calculateSettlements(participants, expenses, settlementRecords = []) {
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

  // A recorded settlement is money that actually changed hands
  for (const rec of settlementRecords) {
    if (!(rec.from_participant in netBalance) || !(rec.to_participant in netBalance)) continue
    netBalance[rec.from_participant] += Number(rec.amount)
    netBalance[rec.to_participant] -= Number(rec.amount)
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
