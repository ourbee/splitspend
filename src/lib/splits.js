// Penny-accurate equal split: each share is floor'd to the cent and the
// remainder goes to the first participant, so shares always sum to the total.
export function computeEqualSplits(amount, participantIds) {
  const shareAmount = Math.floor((amount * 100) / participantIds.length) / 100
  const remainder = Math.round((amount - shareAmount * participantIds.length) * 100) / 100

  return participantIds.map((participantId, idx) => ({
    participant_id: participantId,
    share_amount: idx === 0 ? Math.round((shareAmount + remainder) * 100) / 100 : shareAmount,
  }))
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

// An expense is "unequal" if any two shares differ by more than a cent
// (the equal-split remainder can make the first share 1 cent larger).
export function isUnequalSplit(splits) {
  if (!splits || splits.length < 2) return false
  const amounts = splits.map((s) => Number(s.share_amount))
  return Math.max(...amounts) - Math.min(...amounts) > 0.011
}
