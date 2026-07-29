/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'
import { currencySymbol } from '../lib/currency'
import ConfirmDialog from './ConfirmDialog'

export default function SettlementList() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const recordSettlement = useTripStore((s) => s.recordSettlement)
  const undoSettlement = useTripStore((s) => s.undoSettlement)
  const symbol = currencySymbol(trip?.currency)

  const [settling, setSettling] = useState(null) // "from-to" key being recorded
  const [undoingId, setUndoingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to settle</p>
      </div>
    )
  }

  // Recorded settlements are folded into the balances, so what comes back
  // here is exactly what is still outstanding.
  const { settlements } = calculateSettlements(participants, expenses, settlementRecords)

  const getName = (id) => participants.find((p) => p.id === id)?.name || 'Unknown'
  const getEmoji = (id) => participants.find((p) => p.id === id)?.emoji || ''

  const handleSettle = async (s) => {
    const key = `${s.from}-${s.to}`
    setSettling(key)
    setError(null)
    try {
      await recordSettlement(trip.id, s.from, s.to, s.amount)
    } catch (err) {
      setError('Failed to record settlement: ' + err.message)
    }
    setSettling(null)
  }

  const handleUndo = async () => {
    setBusy(true)
    setError(null)
    try {
      await undoSettlement(undoingId, trip.id)
      setUndoingId(null)
    } catch (err) {
      setError('Failed to undo: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {settlements.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 24, marginBottom: 8 }}>All settled!</p>
          <p>No payments needed</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Payments to Settle ({settlements.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {settlements.map((s, i) => {
              const key = `${s.from}-${s.to}`
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < settlements.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.from)} {getName(s.from)}</span>
                      <span style={{ color: 'var(--color-text-muted)', margin: '0 8px' }}>pays</span>
                      <span style={{ fontWeight: 600 }}>{getEmoji(s.to)} {getName(s.to)}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      {symbol}{s.amount.toLocaleString()}
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
      )}

      {error && !undoingId && (
        <p style={{ color: 'var(--color-danger)', fontSize: 14, textAlign: 'center' }}>{error}</p>
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
                  onClick={() => { setError(null); setUndoingId(rec.id) }}
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

      {undoingId && (
        <ConfirmDialog
          title="Undo this settlement?"
          message="The payment record will be removed and the amount will show as owed again."
          confirmLabel="Undo"
          danger
          busy={busy}
          error={error}
          onConfirm={handleUndo}
          onCancel={() => setUndoingId(null)}
        />
      )}
    </div>
  )
}
