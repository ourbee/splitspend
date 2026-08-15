/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { currencySymbol } from '../lib/currency'
import { isUnequalSplit } from '../lib/splits'
import { paletteEntry, resolveColorSlots } from '../lib/personColors'
import { categoryEmoji, labelFor } from '../lib/categories'
import LineItemsTable from './LineItemsTable'
import CategoryPicker from './CategoryPicker'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function ExpenseCard({ expense, onDelete, onEdit, showDate = true, draggable = false }) {
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const symbol = currencySymbol(trip?.currency)

  const getParticipant = (id) => participants.find((p) => p.id === id)
  const payer = getParticipant(expense.paid_by)
  const color = paletteEntry(resolveColorSlots(participants)[expense.paid_by])
  const adder = expense.created_by ? getParticipant(expense.created_by) : null
  const unequal = isUnequalSplit(expense.splits)
  // A hand-picked emoji wins; otherwise the description is re-read every time,
  // so editing the text updates the icon.
  const icon = expense.emoji || categoryEmoji(expense.description)
  // Where this expense sits in the report, shown on the card itself so the
  // categorisation is visible where the expense is — and correctable there
  // too, which is what retired the old "Fix a category" list under Reports.
  const label = labelFor(expense)
  const [showCategory, setShowCategory] = useState(false)

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

  const dateLabel = showDate ? formatDate(expense.expense_date || expense.created_at) : ''

  return (
    <div
      className="card"
      style={{
        background: color.tint,
        borderLeft: `4px solid ${color.accent}`,
        cursor: draggable ? 'grab' : undefined,
      }}
    >
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
          <span style={{ marginRight: 6 }} aria-hidden="true">{icon}</span>
          {expense.description}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Paid by {payer?.emoji || ''} {payer?.name || 'Unknown'}{dateLabel ? ` · ${dateLabel}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Split: {splitLabel}
        </div>
        {expense.note && (
          <div className="expense-note">{expense.note}</div>
        )}
        {/* Collapsed by default — a twenty-line grocery receipt would
            otherwise bury the card it belongs to. The pointer press is
            swallowed so opening the table on a draggable card doesn't
            start a drag instead. */}
        {expense.line_items?.length > 0 && (
          <div onPointerDown={draggable ? (e) => e.stopPropagation() : undefined}>
            <LineItemsTable
              items={expense.line_items}
              symbol={symbol}
              amount={expense.amount}
            />
          </div>
        )}
        {adder && adder.id !== expense.paid_by && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, opacity: 0.8 }}>
            Added by {adder.name}
          </div>
        )}
      </div>
      {/* The drag listeners sit on the whole card, so the buttons swallow the
          pointer press to stop a long press on them starting a drag. */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        onPointerDown={draggable ? (e) => e.stopPropagation() : undefined}
      >
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

      {/* The card's footing: the space under the amount, which was empty. A
          dashed chip is still only a guess; a solid one is somebody's
          decision. Either way, tapping it changes the heading — the same
          write the Reports tab used to own. */}
      <div
        className="expense-card-foot"
        onPointerDown={draggable ? (e) => e.stopPropagation() : undefined}
      >
        <button
          type="button"
          className={`category-chip ${label.stored ? 'set' : 'guessed'}`}
          onClick={() => setShowCategory(true)}
          title={label.stored
            ? `${label.category.label} · ${label.sub.label} — tap to change`
            : `Guessed from the description — tap to set it`}
        >
          <span className="category-chip-emoji" aria-hidden="true">{label.sub.emoji}</span>
          {label.sub.label}
        </button>
      </div>

      {showCategory && (
        <CategoryPicker expense={expense} onClose={() => setShowCategory(false)} />
      )}
    </div>
  )
}
