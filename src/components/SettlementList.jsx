import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'

const CURRENCY_SYMBOLS = { INR: '\u20b9', USD: '$', EUR: '\u20ac', GBP: '\u00a3' }

export default function SettlementList() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const recordSettlement = useTripStore((s) => s.recordSettlement)
  const undoSettlement = useTripStore((s) => s.undoSettlement)
  const symbol = CURRENCY_SYMBOLS[trip?.currency] || trip?.currency || ''

  const [settling, setSettling] = useState(null) // "from-to" key of settlement being recorded

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to settle</p>
      </div>
    )
  }

  const { settlements } = calculateSettlements(participants, expenses)

  const getName = (id) => participants.find((p) => p.id === id)?.name || 'Unknown'
  const getEmoji = (id) => participants.find((p) => p.id === id)?.emoji || ''

  // Calculate how much has already been settled between each pair
  const settledAmounts = {}
  for (const rec of settlementRecords) {
    const key = `${rec.from_participant}-${rec.to_participant}`
    settledAmounts[key] = (settledAmounts[key] || 0) + Number(rec.amount)
  }

  // Compute remaining settlements after accounting for recorded payments
  const remainingSettlements = settlements.map((s) => {
    const key = `${s.from}-${s.to}`
    const settled = settledAmounts[key] || 0
    const remaining = Math.round((s.amount - settled) * 100) / 100
    return { ...s, settled, remaining }
  }).filter(s => s.remaining > 0.01)

  const fullySettled = settlements.filter((s) => {
    const key = `${s.from}-${s.to}`
    const settled = settledAmounts[key] || 0
    return settled >= s.amount - 0.01
  })

  const handleSettle = async (s) => {
    const key = `${s.from}-${s.to}`
    setSettling(key)
    try {
      await recordSettlement(trip.id, s.from, s.to, s.remaining)
    } catch (err) {
      alert('Failed to record settlement: ' + err.message)
    }
    setSettling(null)
  }

  const handleUndoSettlement = async (recordId) => {
    if (!window.confirm('Undo this settlement?')) return
    try {
      await undoSettlement(recordId, trip.id)
    } catch (err) {
      alert('Failed to undo: ' + err.message)
    }
  }

  const allSettled = remainingSettlements.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {allSettled && settlements.length > 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
          <p>All payments have been recorded</p>
        </div>
      ) : remainingSettlements.length > 0 ? (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Payments to Settle ({remainingSettlements.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {remainingSettlements.map((s, i) => {
              const key = `${s.from}-${s.to}`
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < remainingSettlements.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.from)} {getName(s.from)}</span>
                      <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>pays</span>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.to)} {getName(s.to)}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      {symbol}{s.remaining.toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
                    onClick={() => handleSettle(s)}
                    disabled={settling === key}
                  >
                    {settling === key ? 'Recording...' : 'Mark as Settled'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
          <p>No payments needed</p>
        </div>
      )}

      {/* Settlement history */}
      {settlementRecords.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Settlement History ({settlementRecords.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {settlementRecords.map((rec) => (
              <div
                key={rec.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {getEmoji(rec.from_participant)} {getName(rec.from_participant)}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', margin: '0 6px', fontSize: 13 }}>paid</span>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {getEmoji(rec.to_participant)} {getName(rec.to_participant)}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)', marginLeft: 8, fontSize: 14 }}>
                    {symbol}{Number(rec.amount).toLocaleString()}
                  </span>
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => handleUndoSettlement(rec.id)}
                  style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '4px 8px' }}
                  title="Undo settlement"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
