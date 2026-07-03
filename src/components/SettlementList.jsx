import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function SettlementList() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to settle</p>
      </div>
    )
  }

  const { settlements } = calculateSettlements(participants, expenses)

  const getName = (id) => participants.find((p) => p.id === id)?.name || 'Unknown'

  if (settlements.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
        <p>No payments needed</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
          Payments to Settle ({settlements.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {settlements.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: i < settlements.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{getName(s.from)}</span>
                <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>pays</span>
                <span style={{ fontWeight: 600 }}>{getName(s.to)}</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                {symbol}{s.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
