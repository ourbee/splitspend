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
