import { useState } from 'react'

const CURRENCIES = [
  { code: 'INR', symbol: '\u20b9', label: 'INR (\u20b9)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '\u20ac', label: 'EUR (\u20ac)' },
  { code: 'GBP', symbol: '\u00a3', label: 'GBP (\u00a3)' },
]

export default function CreateTripForm({ onSubmit, loading }) {
  const [tripName, setTripName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [participantName, setParticipantName] = useState('')
  const [participants, setParticipants] = useState([])

  const addParticipant = () => {
    const name = participantName.trim()
    if (!name) return
    if (participants.some((p) => p.toLowerCase() === name.toLowerCase())) return
    setParticipants([...participants, name])
    setParticipantName('')
  }

  const removeParticipant = (index) => {
    setParticipants(participants.filter((_, i) => i !== index))
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
    onSubmit(tripName.trim(), currency, participants)
  }

  const canSubmit = tripName.trim() && participants.length >= 2 && !loading

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label className="label">Trip Name</label>
        <input
          className="input"
          placeholder="e.g. Goa Trip 2026"
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {participants.map((name, i) => (
              <span key={i} className="chip">
                {name}
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => removeParticipant(i)}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {participants.length < 2 && participants.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Add at least 2 participants
          </p>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {loading ? 'Creating...' : 'Create Trip'}
      </button>
    </form>
  )
}
