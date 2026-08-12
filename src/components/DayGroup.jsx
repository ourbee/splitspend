/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import useTripStore from '../store/tripStore'
import SortableExpense from './SortableExpense'
import { positionFor } from '../lib/expenseOrder'
import { currencySymbol } from '../lib/currency'
import { round2 } from '../lib/splits'

/**
 * One day's expenses, with its own drag context.
 *
 * Each day being a separate DndContext is what keeps a card inside its day —
 * there is simply nowhere else for it to land — and `restrictToParentElement`
 * draws the boundary the user can see.
 */
export default function DayGroup({ group, onEdit, onDelete, dragDisabled }) {
  const trip = useTripStore((s) => s.trip)
  const reorderExpense = useTripStore((s) => s.reorderExpense)
  const setReordering = useTripStore((s) => s.setReordering)
  const symbol = currencySymbol(trip?.currency)

  const [items, setItems] = useState(null) // local order while dragging
  const [error, setError] = useState(null)

  const ordered = items ?? group.expenses

  const sensors = useSensors(
    // Desktop drags on movement; touch waits for a long press so an ordinary
    // swipe still scrolls the list.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = () => {
    setError(null)
    setReordering(true)
  }

  const handleDragCancel = () => {
    setItems(null)
    setReordering(false)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      handleDragCancel()
      return
    }

    const from = ordered.findIndex((e) => e.id === active.id)
    const to = ordered.findIndex((e) => e.id === over.id)
    if (from < 0 || to < 0) {
      handleDragCancel()
      return
    }

    const next = arrayMove(ordered, from, to)
    setItems(next)

    try {
      await reorderExpense(trip.id, active.id, positionFor(next, to))
    } catch (err) {
      setError('Could not save the new order: ' + err.message)
    }
    setItems(null)
    setReordering(false)
  }

  const body = ordered.map((expense) => (
    <SortableExpense
      key={expense.id}
      expense={expense}
      onEdit={onEdit}
      onDelete={onDelete}
      disabled={dragDisabled}
    />
  ))

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="day-heading">
        <span>{group.heading}</span>
        <span className="day-heading-total">
          {symbol}{round2(group.total).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>

      {dragDisabled ? (
        <div className="day-items">{body}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={ordered.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="day-items">{body}</div>
          </SortableContext>
        </DndContext>
      )}

      {error && (
        <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 6 }}>{error}</p>
      )}
    </div>
  )
}
