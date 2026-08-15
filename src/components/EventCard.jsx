/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import useTripStore from '../store/tripStore'
import { experienceEmoji, experienceStyle } from '../lib/experiences'

/**
 * A diary moment rather than a transaction: no amount, no payer, no splits.
 *
 * Still deliberately styled apart from expense cards, but no longer plain. An
 * expense wears the payer's colour — cool, saturated, per-person. An event
 * wears the register its own words put it in: parchment tints and a stripe
 * keyed to what happened, not to who paid. The dashed outline stays as the
 * shared signature of "this one isn't money".
 */
export default function EventCard({ event, onDelete, onEdit, draggable = false }) {
  const participants = useTripStore((s) => s.participants)
  const adder = event.created_by
    ? participants.find((p) => p.id === event.created_by)
    : null

  // A hand-picked emoji wins; otherwise the title is re-read every time, so
  // editing the words updates both the icon and the colour with them.
  const icon = event.emoji || experienceEmoji(event.title)
  const register = experienceStyle(event)

  return (
    <div
      className="event-card"
      style={{
        background: register.tint,
        borderColor: `${register.accent}55`,
        boxShadow: `inset 5px 0 0 ${register.accent}`,
        cursor: draggable ? 'grab' : undefined,
      }}
    >
      <span
        className="event-card-emoji"
        style={{ background: `${register.accent}22` }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{event.title}</div>
        {event.note && (
          <div className="expense-note" style={{ marginTop: 2 }}>{event.note}</div>
        )}
        <div className="event-card-foot">
          {adder && (
            <span style={{ opacity: 0.8 }}>Added by {adder.emoji || ''} {adder.name}</span>
          )}
          {/* The register, named quietly — the same small-type footing the
              expense cards carry their category in. */}
          <span className="event-register" style={{ color: register.accent }}>
            {register.label}
          </span>
        </div>
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
