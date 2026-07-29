/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import useTripStore from '../store/tripStore'
import { currencySymbol } from '../lib/currency'
import { isUnequalSplit } from '../lib/splits'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function ExpenseCard({ expense, onDelete, onEdit }) {
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const symbol = currencySymbol(trip?.currency)

  const getParticipant = (id) => participants.find((p) => p.id === id)
  const payer = getParticipant(expense.paid_by)
  const adder = expense.created_by ? getParticipant(expense.created_by) : null
  const unequal = isUnequalSplit(expense.splits)

  let splitLabel
  if (unequal) {
    splitLabel = expense.splits
      .map((s) => {
        const p = getParticipant(s.participant_id)
        return p ? `${p.name} ${symbol}${Number(s.share_amount).toLocaleString()}` : null
      })
      .filter(Boolean)
      .join(' · ')
  } else {
    const splitNames = expense.splits
      .map((s) => {
        const p = getParticipant(s.participant_id)
        return p ? `${p.emoji || ''} ${p.name}`.trim() : null
      })
      .filter(Boolean)
    splitLabel = splitNames.length === participants.length
      ? `Everyone (${splitNames.length})`
      : splitNames.join(', ')
  }

  const dateLabel = formatDate(expense.expense_date || expense.created_at)

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
          {expense.description}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Paid by {payer?.emoji || ''} {payer?.name || 'Unknown'}{dateLabel ? ` · ${dateLabel}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Split: {splitLabel}
        </div>
        {adder && adder.id !== expense.paid_by && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, opacity: 0.8 }}>
            Added by {adder.name}
          </div>
        )}
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
