/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import useTripStore from '../store/tripStore'

/**
 * A diary moment rather than a transaction: no amount, no payer, no splits.
 * Deliberately styled apart from expense cards — flat surface, dashed border,
 * no person tint — so the timeline reads as "money, money, memory, money".
 */
export default function EventCard({ event, onDelete, onEdit, draggable = false }) {
  const participants = useTripStore((s) => s.participants)
  const adder = event.created_by
    ? participants.find((p) => p.id === event.created_by)
    : null

  return (
    <div className="event-card" style={{ cursor: draggable ? 'grab' : undefined }}>
      <span className="event-card-emoji" aria-hidden="true">{event.emoji || '📍'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{event.title}</div>
        {event.note && (
          <div className="expense-note" style={{ marginTop: 2 }}>{event.note}</div>
        )}
        {adder && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, opacity: 0.8 }}>
            Added by {adder.emoji || ''} {adder.name}
          </div>
        )}
      </div>
      {/* The drag listeners sit on the whole card, so the buttons swallow the
          pointer press to stop a long press on them starting a drag. */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        onPointerDown={draggable ? (e) => e.stopPropagation() : undefined}
      >
        {onEdit && (
          <button
            className="btn-ghost"
            onClick={() => onEdit(event)}
            style={{ fontSize: 15, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Edit event"
          >
            &#9998;
          </button>
        )}
        {onDelete && (
          <button
            className="btn-ghost"
            onClick={() => onDelete(event.id)}
            style={{ fontSize: 18, color: 'var(--color-text-muted)', padding: '4px' }}
            title="Delete event"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  )
}
