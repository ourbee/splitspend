/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { EMOJI_OPTIONS } from '../lib/emojis'
import { paletteSwatches, resolveColorSlots, takenSlots } from '../lib/personColors'
import EmojiPicker from './EmojiPicker'

export default function IdentitySheet({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const updateParticipantEmoji = useTripStore((s) => s.updateParticipantEmoji)
  const updateParticipantColor = useTripStore((s) => s.updateParticipantColor)

  const [showEmoji, setShowEmoji] = useState(false)
  const [busySlot, setBusySlot] = useState(null)
  const [error, setError] = useState(null)

  const me = participants.find((p) => p.id === myIdentity)
  if (!me) return null

  const slots = resolveColorSlots(participants)
  const mySlot = slots[me.id]
  const unavailable = takenSlots(participants, me.id)
  const usedEmojis = participants.filter((p) => p.id !== me.id).map((p) => p.emoji).filter(Boolean)

  const pickColor = async (slot) => {
    if (slot === mySlot && me.color != null) return
    setBusySlot(slot)
    setError(null)
    try {
      await updateParticipantColor(trip.id, me.id, slot)
    } catch (err) {
      setError(err.code === 'TAKEN'
        ? 'Someone else just took that colour.'
        : 'Could not save that colour: ' + err.message)
    }
    setBusySlot(null)
  }

  const pickEmoji = async (emoji) => {
    setError(null)
    try {
      await updateParticipantEmoji(trip.id, me.id, emoji)
    } catch (err) {
      setError('Could not save that emoji: ' + err.message)
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>You are {me.name}</h2>
            <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }} aria-label="Close">
              &times;
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            How you appear to everyone else in this group.
          </p>

          <div style={{ marginBottom: 22 }}>
            <label className="label">Your emoji</label>
            <button
              type="button"
              className="identity-emoji"
              onClick={() => setShowEmoji(true)}
            >
              <span style={{ fontSize: 30 }}>{me.emoji || '🙂'}</span>
              <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
                Change
              </span>
            </button>
          </div>

          <div>
            <label className="label">Your colour</label>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Tints the expenses you paid for. Colours already used by someone
              else in this group can’t be picked.
            </p>
            <div className="swatch-grid">
              {paletteSwatches().map((c) => {
                const taken = unavailable.has(c.slot)
                const selected = mySlot === c.slot
                return (
                  <button
                    key={c.slot}
                    type="button"
                    className={`swatch ${selected ? 'selected' : ''}`}
                    style={{ background: c.tint, borderColor: selected ? c.accent : 'transparent' }}
                    disabled={taken || busySlot != null}
                    title={taken ? `${c.name} — already taken` : c.name}
                    aria-label={taken ? `${c.name}, already taken` : c.name}
                    onClick={() => pickColor(c.slot)}
                  >
                    <span className="swatch-dot" style={{ background: c.accent }} />
                    <span className="swatch-name">{taken ? '—' : c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 14 }}>{error}</p>
          )}

          <button className="btn btn-secondary" style={{ marginTop: 22 }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {showEmoji && (
        <EmojiPicker
          title="Pick your emoji"
          groups={[{ label: '', emojis: EMOJI_OPTIONS }]}
          value={me.emoji}
          disabled={usedEmojis}
          onPick={pickEmoji}
          onClose={() => setShowEmoji(false)}
        />
      )}
    </>
  )
}
