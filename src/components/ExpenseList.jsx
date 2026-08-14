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
import { sortExpenses } from '../lib/expenseOrder'
import { guessLabel } from '../lib/categories'

// Everything is already in memory, so search is a plain filter — no query,
// no debounce needed at trip-sized data. Diary events join in on their
// title and note.
function matches(expense, query, participants) {
  if (expense._type === 'event') {
    return [expense.title, expense.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  }
  const payer = participants.find((p) => p.id === expense.paid_by)
  const guess = guessLabel(expense.description)
  const haystack = [
    expense.description,
    expense.note,
    payer?.name,
    String(expense.amount),
    // Searching "food" or "taxi" should find the expense whether its labels
    // were stored by a previous Reports visit or are only being guessed now.
    expense.category,
    expense.subcategory,
    guess.category.label,
    guess.sub.label,
    // Bill rows read off a photo are searchable too — "paneer" finds the
    // dinner it was an item on.
    ...(expense.line_items || []).map((i) => i.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export default function ExpenseList({ onEdit }) {
  const expenses = useTripStore((s) => s.expenses)
  const events = useTripStore((s) => s.events)
  const participants = useTripStore((s) => s.participants)
  const trip = useTripStore((s) => s.trip)
  const deleteExpense = useTripStore((s) => s.deleteExpense)
  const deleteEvent = useTripStore((s) => s.deleteEvent)

  const [confirmingId, setConfirmingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  // Expenses and diary events interleave into one timeline; they share the
  // per-day sort_order space, so one sort covers both.
  const items = useMemo(() => sortExpenses([...expenses, ...events]), [expenses, events])

  const filtered = useMemo(
    () => (query ? items.filter((e) => matches(e, query, participants)) : items),
    [items, query, participants]
  )

  const confirming = confirmingId ? items.find((e) => e.id === confirmingId) : null

  // Day totals follow the filter, so they always add up to what is on screen.
  const groups = useMemo(() => groupByDay(filtered), [filtered])

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      if (confirming?._type === 'event') {
        await deleteEvent(confirmingId, trip.id)
      } else {
        await deleteExpense(confirmingId, trip.id)
      }
      setConfirmingId(null)
    } catch (err) {
      setError('Failed to delete: ' + err.message)
    }
    setBusy(false)
  }

  if (items.length === 0) {
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
          {filtered.length} of {items.length} item{items.length === 1 ? '' : 's'}
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
          title={confirming?._type === 'event' ? 'Delete this event?' : 'Delete this expense?'}
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
