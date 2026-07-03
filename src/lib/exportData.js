import { calculateSettlements } from './settlement'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

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
