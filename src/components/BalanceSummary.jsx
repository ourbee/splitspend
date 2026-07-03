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
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Trip Spend</div>
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
