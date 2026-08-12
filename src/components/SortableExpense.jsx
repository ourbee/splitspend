/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ExpenseCard from './ExpenseCard'

export default function SortableExpense({ expense, onEdit, onDelete, disabled }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: expense.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 5 : undefined,
    position: 'relative',
    // Long-press starts a drag; a plain swipe still scrolls the page.
    touchAction: disabled ? undefined : 'manipulation',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'expense-dragging' : undefined}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      <ExpenseCard
        expense={expense}
        showDate={false}
        draggable={!disabled}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
