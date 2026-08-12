/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { computeEqualSplits, isUnequalSplit, round2 } from '../lib/splits'
import { currencySymbol } from '../lib/currency'
import { categoryEmoji } from '../lib/categories'
import { EXPENSE_EMOJI_GROUPS } from '../lib/expenseEmojis'
import EmojiPicker from './EmojiPicker'

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function AddExpenseModal({ onClose, expense }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const addExpense = useTripStore((s) => s.addExpense)
  const updateExpense = useTripStore((s) => s.updateExpense)
  const symbol = currencySymbol(trip?.currency)

  const isEdit = !!expense
  const editUnequal = isEdit && isUnequalSplit(expense.splits)

  const [description, setDescription] = useState(isEdit ? expense.description : '')
  const [amount, setAmount] = useState(isEdit ? String(expense.amount) : '')
  const [paidBy, setPaidBy] = useState(isEdit ? expense.paid_by : (participants[0]?.id || ''))
  const [expenseDate, setExpenseDate] = useState(
    isEdit && expense.expense_date ? expense.expense_date : todayStr()
  )
  const [splitMode, setSplitMode] = useState(editUnequal ? 'custom' : 'equal')
  const [splitAll, setSplitAll] = useState(
    isEdit ? expense.splits.length === participants.length : true
  )
  const [splitAmong, setSplitAmong] = useState(
    isEdit ? expense.splits.map((s) => s.participant_id) : participants.map((p) => p.id)
  )
  const [customShares, setCustomShares] = useState(() => {
    if (!isEdit) return {}
    const shares = {}
    for (const s of expense.splits) shares[s.participant_id] = String(Number(s.share_amount))
    return shares
  })
  const [note, setNote] = useState(isEdit ? (expense.note || '') : '')
  // null means "keep following the description" — that way editing the text of
  // an expense nobody has re-iconed re-runs the guess, while a hand-picked
  // emoji is never overwritten.
  const [emoji, setEmoji] = useState(isEdit ? (expense.emoji || null) : null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const guessedEmoji = categoryEmoji(description)
  const shownEmoji = emoji || guessedEmoji

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

  const setShare = (id, value) => {
    setCustomShares({ ...customShares, [id]: value })
  }

  const parsedAmount = parseFloat(amount)

  // Custom-split bookkeeping
  const customTotal = round2(
    splitAmong.reduce((sum, id) => sum + (parseFloat(customShares[id]) || 0), 0)
  )
  const customRemaining = round2((parsedAmount || 0) - customTotal)
  const customValid = parsedAmount > 0 && Math.abs(customRemaining) < 0.011 &&
    splitAmong.every((id) => (parseFloat(customShares[id]) || 0) >= 0)

  const canSubmit =
    description.trim() &&
    parsedAmount > 0 &&
    paidBy &&
    splitAmong.length > 0 &&
    (splitMode === 'equal' || customValid) &&
    !loading

  const buildSplits = () => {
    if (splitMode === 'equal') {
      return computeEqualSplits(parsedAmount, splitAmong)
    }
    return splitAmong
      .map((id) => ({ participant_id: id, share_amount: round2(parseFloat(customShares[id]) || 0) }))
      .filter((s) => s.share_amount > 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    try {
      const splits = buildSplits()
      if (isEdit) {
        await updateExpense(
          expense.id, trip.id, description.trim(), parsedAmount, paidBy, splits,
          expenseDate, note.trim(), emoji
        )
      } else {
        await addExpense(
          trip.id, description.trim(), parsedAmount, paidBy, splits,
          expenseDate, note.trim(), emoji
        )
      }
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Description</label>
            <div className="description-row">
              <input
                className="input"
                placeholder="e.g. Dinner, Taxi, Hotel"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="emoji-trigger"
                onClick={() => setShowEmojiPicker(true)}
                title={emoji ? 'Change icon' : 'Picked automatically — tap to change'}
                aria-label="Change expense icon"
              >
                {shownEmoji}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Anything worth remembering about this one"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
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
            <div style={{ flex: 1 }}>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Paid by</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
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
                  {p.emoji || ''} {p.name}
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
              <span style={{ fontSize: 14, fontWeight: 500 }}>Everyone</span>
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
                    {p.emoji || ''} {p.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">How to split</label>
            <div className="tabs" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className={`tab ${splitMode === 'equal' ? 'active' : ''}`}
                onClick={() => setSplitMode('equal')}
              >
                Equally
              </button>
              <button
                type="button"
                className={`tab ${splitMode === 'custom' ? 'active' : ''}`}
                onClick={() => setSplitMode('custom')}
              >
                Unequally
              </button>
            </div>

            {splitMode === 'equal' && parsedAmount > 0 && splitAmong.length > 0 && (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {splitAmong.length === 1
                  ? `${participants.find(p => p.id === splitAmong[0])?.name} pays full amount`
                  : `Split: ${symbol}${(parsedAmount / splitAmong.length).toFixed(2)} each`
                }
              </p>
            )}

            {splitMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {splitAmong.map((id) => {
                  const p = participants.find((x) => x.id === id)
                  if (!p) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                        {p.emoji || ''} {p.name}
                      </span>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customShares[id] ?? ''}
                        onChange={(e) => setShare(id, e.target.value)}
                        style={{ width: 120, padding: '8px 12px' }}
                      />
                    </div>
                  )
                })}
                {parsedAmount > 0 && (
                  <p style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: customValid ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {customValid
                      ? `${symbol}${customTotal.toFixed(2)} assigned ✓`
                      : customRemaining > 0
                        ? `${symbol}${customRemaining.toFixed(2)} left to assign`
                        : `${symbol}${Math.abs(customRemaining).toFixed(2)} over the total`
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {loading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save Changes' : 'Add Expense')}
          </button>
        </form>
      </div>

      {showEmojiPicker && (
        <EmojiPicker
          title="Pick an icon"
          groups={EXPENSE_EMOJI_GROUPS}
          value={emoji}
          onPick={setEmoji}
          onPickAuto={() => setEmoji(null)}
          autoLabel="Automatic"
          autoPreview={guessedEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  )
}
