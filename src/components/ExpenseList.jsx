/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useMemo, useState } from 'react'
import useTripStore from '../store/tripStore'
import ConfirmDialog from './ConfirmDialog'
import ScrollJump from './ScrollJump'
import DayGroup from './DayGroup'
import { groupByDay } from '../lib/dates'
import { categorize } from '../lib/categories'

// Everything is already in memory, so search is a plain filter — no query,
// no debounce needed at trip-sized data.
function matches(expense, query, participants) {
  const payer = participants.find((p) => p.id === expense.paid_by)
  const haystack = [
    expense.description,
    expense.note,
    payer?.name,
    String(expense.amount),
    categorize(expense.description).key,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export default function ExpenseList({ onEdit }) {
  const expenses = useTripStore((s) => s.expenses)
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const deleteExpense = useTripStore((s) => s.deleteExpense)

  const [confirmingId, setConfirmingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => (query ? expenses.filter((e) => matches(e, query, participants)) : expenses),
    [expenses, query, participants]
  )

  // Day totals follow the filter, so they always add up to what is on screen.
  const groups = useMemo(() => groupByDay(filtered), [filtered])

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteExpense(confirmingId, trip.id)
      setConfirmingId(null)
    } catch (err) {
      setError('Failed to delete: ' + err.message)
    }
    setBusy(false)
  }

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 36, marginBottom: 8 }}>No expenses yet</p>
        <p>Tap + to add your first expense</p>
      </div>
    )
  }

  return (
    <div>
      <div className="expense-search">
        <input
          className="input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expenses, people, amounts"
          aria-label="Search expenses"
        />
        {query && (
          <button
            className="expense-search-clear"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            title="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {query && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
          {filtered.length} of {expenses.length} expense{expenses.length === 1 ? '' : 's'}
          {' · '}reordering is off while searching
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No expenses match “{search.trim()}”</p>
        </div>
      ) : (
        groups.map((group) => (
          <DayGroup
            key={group.key}
            group={group}
            onEdit={onEdit}
            onDelete={(id) => { setError(null); setConfirmingId(id) }}
            // A position "between" two cards whose neighbours are filtered out
            // of view has no meaning, so dragging is off while searching.
            dragDisabled={!!query}
          />
        ))
      )}

      <ScrollJump />

      {confirmingId && (
        <ConfirmDialog
          title="Delete this expense?"
          message="This removes it for everyone in the group."
          confirmLabel="Delete"
          danger
          busy={busy}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingId(null)}
        />
      )}
    </div>
  )
}
