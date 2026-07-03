import useTripStore from '../store/tripStore'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function ExpenseCard({ expense, onDelete }) {
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  const payer = participants.find((p) => p.id === expense.paid_by)
  const splitNames = expense.splits
    .map((s) => {
      const p = participants.find((p) => p.id === s.participant_id)
      return p ? `${p.emoji || ''} ${p.name}`.trim() : null
    })
    .filter(Boolean)

  const splitLabel =
    splitNames.length === participants.length
      ? `Everyone (${splitNames.length})`
      : splitNames.join(', ')

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
          {expense.description}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Paid by {payer?.emoji || ''} {payer?.name || 'Unknown'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Split: {splitLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          {symbol}{Number(expense.amount).toLocaleString()}
        </span>
        {onDelete && (
          <button
            className="btn-ghost"
            onClick={() => onDelete(expense.id)}
            style={{ fontSize: 18, color: 'var(--color-text-muted)' }}
            title="Delete expense"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
