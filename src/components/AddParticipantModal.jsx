import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { EMOJI_OPTIONS, getRandomEmoji } from '../lib/emojis'

export default function AddParticipantModal({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const addParticipant = useTripStore((s) => s.addParticipant)

  const usedEmojis = participants.map(p => p.emoji)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(getRandomEmoji(usedEmojis))
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (participants.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A participant with this name already exists')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await addParticipant(trip.id, trimmed, emoji)
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Participant</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Emoji</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  background: 'var(--color-bg)',
                  border: '2px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 28,
                  padding: '8px 16px',
                  lineHeight: 1,
                }}
              >
                {emoji}
              </button>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                Tap to change
              </span>
            </div>
            {showEmojiPicker && (
              <div style={{
                marginTop: 8,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
              }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                    style={{
                      background: emoji === e ? 'var(--color-primary-light)' : 'none',
                      border: emoji === e ? '2px solid var(--color-primary)' : '2px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: 20,
                      padding: 4,
                      lineHeight: 1,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading}>
            {loading ? 'Adding...' : 'Add Participant'}
          </button>
        </form>
      </div>
    </div>
  )
}
