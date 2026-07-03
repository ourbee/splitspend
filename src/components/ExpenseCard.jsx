import useTripStore from '../store/tripStore'

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export default function ExpenseCard({ expense, onDelete, onEdit }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          {symbol}{Number(expense.amount).toLocaleString()}
        </span>
        {onEdit && (
          <button
            className="btn-ghost"
            onClick={() => onEdit(expense)}
            style={{ fontSize: 15, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Edit expense"
          >
            &#9998;
          </button>
        )}
        {onDelete && (
          <button
            className="btn-ghost"
            onClick={() => onDelete(expense.id)}
            style={{ fontSize: 18, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Delete expense"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
