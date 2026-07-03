import { useState } from 'react'
import { EMOJI_OPTIONS, getRandomEmoji } from '../lib/emojis'

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
]

export default function CreateTripForm({ onSubmit, loading }) {
  const [tripName, setTripName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [participantName, setParticipantName] = useState('')
  // participants: [{ name, emoji }]
  const [participants, setParticipants] = useState([])
  const [creatorIndex, setCreatorIndex] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null) // index of participant

  const usedEmojis = participants.map(p => p.emoji)

  const addParticipant = () => {
    const name = participantName.trim()
    if (!name) return
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) return
    const emoji = getRandomEmoji(usedEmojis)
    setParticipants([...participants, { name, emoji }])
    setParticipantName('')
  }

  const removeParticipant = (index) => {
    const next = participants.filter((_, i) => i !== index)
    setParticipants(next)
    // Adjust creatorIndex if needed
    if (creatorIndex >= next.length) {
      setCreatorIndex(Math.max(0, next.length - 1))
    } else if (creatorIndex > index) {
      setCreatorIndex(creatorIndex - 1)
    }
  }

  const setEmoji = (index, emoji) => {
    setParticipants(participants.map((p, i) => i === index ? { ...p, emoji } : p))
    setShowEmojiPicker(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addParticipant()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tripName.trim() || participants.length < 2) return
    onSubmit(tripName.trim(), currency, participants, creatorIndex)
  }

  const canSubmit = tripName.trim() && participants.length >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          placeholder="e.g. Goa Trip, Flat Expenses, Dinner"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">Currency</label>
        <select
          className="select"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Participants ({participants.length})</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: participants.length ? 12 : 0 }}>
          <input
            className="input"
            placeholder="Add a name"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addParticipant}
            disabled={!participantName.trim()}
            style={{ width: 'auto', padding: '12px 16px' }}
          >
            Add
          </button>
        </div>

        {participants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {participants.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div
                  className="chip"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: creatorIndex === i ? 'var(--color-primary-light)' : undefined,
                    border: creatorIndex === i ? '2px solid var(--color-primary)' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === i ? null : i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 20,
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Change emoji"
                    >
                      {p.emoji}
                    </button>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    {creatorIndex === i && (
                      <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>YOU</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {creatorIndex !== i && (
                      <button
                        type="button"
                        onClick={() => setCreatorIndex(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          padding: '2px 6px',
                        }}
                        title="This is me"
                      >
                        This is me
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeParticipant(i)}
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {showEmojiPicker === i && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    boxShadow: 'var(--shadow-modal)',
                    marginTop: 4,
                  }}>
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEmoji(i, emoji)}
                        style={{
                          background: p.emoji === emoji ? 'var(--color-primary-light)' : 'none',
                          border: p.emoji === emoji ? '2px solid var(--color-primary)' : '2px solid transparent',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: 20,
                          padding: 4,
                          lineHeight: 1,
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {participants.length < 2 && participants.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Add at least 2 participants
          </p>
        )}

        {participants.length >= 2 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Tag yourself by clicking "This is me" next to your name
          </p>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {loading ? 'Creating...' : 'Create Splitspend'}
      </button>
    </form>
  )
}
