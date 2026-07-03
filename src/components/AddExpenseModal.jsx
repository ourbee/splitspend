import { useState } from 'react'
import useTripStore from '../store/tripStore'

export default function AddExpenseModal({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const addExpense = useTripStore((s) => s.addExpense)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(participants[0]?.id || '')
  const [splitAll, setSplitAll] = useState(true)
  const [splitAmong, setSplitAmong] = useState(participants.map((p) => p.id))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const toggleParticipant = (id) => {
    if (splitAmong.includes(id)) {
      const next = splitAmong.filter((pid) => pid !== id)
      if (next.length === 0) return
      setSplitAmong(next)
      setSplitAll(next.length === participants.length)
    } else {
      const next = [...splitAmong, id]
      setSplitAmong(next)
      setSplitAll(next.length === participants.length)
    }
  }

  const toggleAll = () => {
    if (splitAll) {
      setSplitAll(false)
    } else {
      setSplitAll(true)
      setSplitAmong(participants.map((p) => p.id))
    }
  }

  const parsedAmount = parseFloat(amount)
  const canSubmit = description.trim() && parsedAmount > 0 && paidBy && splitAmong.length > 0 && !loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    try {
      await addExpense(trip.id, description.trim(), parsedAmount, paidBy, splitAmong)
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add Expense</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="e.g. Dinner, Taxi, Hotel"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Amount</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Paid by</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={paidBy === p.id ? 'chip' : 'chip'}
                  style={paidBy === p.id ? {
                    background: 'var(--color-primary)',
                    color: 'white',
                    cursor: 'pointer',
                    border: 'none',
                  } : {
                    background: 'var(--color-border)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                  onClick={() => setPaidBy(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Split among</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={splitAll}
                onChange={toggleAll}
                style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Everyone equally</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {participants.map((p) => {
                const selected = splitAmong.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    style={selected ? {
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      border: '2px solid var(--color-primary)',
                    } : {
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      border: '2px solid var(--color-border)',
                    }}
                    onClick={() => toggleParticipant(p.id)}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            {parsedAmount > 0 && splitAmong.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
                {splitAmong.length === 1
                  ? `${participants.find(p => p.id === splitAmong[0])?.name} pays full amount`
                  : `Split: ${(parsedAmount / splitAmong.length).toFixed(2)} each`
                }
              </p>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {loading ? 'Adding...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  )
}
