/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useRef, useState } from 'react'
import useTripStore from '../store/tripStore'
import { computeEqualSplits, isUnequalSplit, round2 } from '../lib/splits'
import { currencySymbol } from '../lib/currency'
import { categoryEmoji } from '../lib/categories'
import { experienceEmoji } from '../lib/experiences'
import { EXPENSE_EMOJI_GROUPS, EVENT_EMOJI_GROUPS } from '../lib/expenseEmojis'
import { scanReceipt } from '../lib/receiptScan'
import { scanDocument } from '../lib/documentScan'
import { normaliseLineItems } from '../lib/lineItems'
import { formatTravel, appendToNote } from '../lib/travelDetails'
import { guessLabelStrings } from '../lib/categories'
import EmojiPicker from './EmojiPicker'
import LineItemsTable from './LineItemsTable'

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function AddExpenseModal({ onClose, expense }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const addExpense = useTripStore((s) => s.addExpense)
  const updateExpense = useTripStore((s) => s.updateExpense)
  const addEvent = useTripStore((s) => s.addEvent)
  const updateEvent = useTripStore((s) => s.updateEvent)
  const symbol = currencySymbol(trip?.currency)

  const isEdit = !!expense
  const editUnequal = isEdit && !expense._type && isUnequalSplit(expense.splits)

  // "You always come first on your own phone": the person adding the expense
  // leads both the Paid-by and Split-among rows on their device only —
  // everyone else's device leads with themselves.
  const me = participants.find((p) => p.id === myIdentity)
  const orderedParticipants = me
    ? [me, ...participants.filter((p) => p.id !== me.id)]
    : participants

  // A one-person Splitspend has nothing to decide about paying or splitting:
  // one chip, one option, one answer. The whole block is hidden rather than
  // shown with a single choice in it — the expense is still stored with a
  // full-amount split against that person, exactly as before, so adding a
  // second participant later brings the controls back with nothing to repair.
  const solo = participants.length < 2

  // Expense or diary event. The one + button covers both; the type is fixed
  // once a card exists, so the toggle only shows while adding.
  const [mode, setMode] = useState(expense?._type === 'event' ? 'event' : 'expense')
  const isEvent = mode === 'event'

  const [description, setDescription] = useState(isEdit ? (expense.description ?? expense.title) : '')
  const [amount, setAmount] = useState(isEdit && !expense._type ? String(expense.amount) : '')
  const [paidBy, setPaidBy] = useState(
    isEdit && !expense._type ? expense.paid_by : (myIdentity || participants[0]?.id || '')
  )
  const [expenseDate, setExpenseDate] = useState(() => {
    const d = isEdit ? (expense.expense_date || expense.event_date) : null
    return d || todayStr()
  })
  const [splitMode, setSplitMode] = useState(editUnequal ? 'custom' : 'equal')
  const [splitAll, setSplitAll] = useState(
    isEdit && !expense._type ? expense.splits.length === participants.length : true
  )
  const [splitAmong, setSplitAmong] = useState(
    isEdit && !expense._type ? expense.splits.map((s) => s.participant_id) : participants.map((p) => p.id)
  )
  const [customShares, setCustomShares] = useState(() => {
    if (!isEdit || expense._type) return {}
    const shares = {}
    for (const s of expense.splits) shares[s.participant_id] = String(Number(s.share_amount))
    return shares
  })
  const [note, setNote] = useState(isEdit ? (expense.note || '') : '')
  // Rows read off a photographed bill. A record only — they are stored beside
  // the expense and never consulted when working out who owes what.
  const [lineItems, setLineItems] = useState(
    isEdit && !expense._type ? (expense.line_items || []) : []
  )
  // null means "keep following the description" — that way editing the text of
  // an expense nobody has re-iconed re-runs the guess, while a hand-picked
  // emoji is never overwritten.
  const [emoji, setEmoji] = useState(isEdit ? (expense.emoji || null) : null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [showScanChoice, setShowScanChoice] = useState(false)
  // Two inputs, not one. A bare accept="image/*" is rendered by iOS as a
  // three-way sheet, but a lot of Android OEM pickers turn it into a
  // gallery-only browser with no way to reach the camera. Adding capture to
  // that single input would fix Android by breaking both platforms' gallery
  // path, so each source gets its own input and the app asks which one.
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  // Events read their icon out of the experience lexicon, expenses out of the
  // spending taxonomy — the same trick, two different vocabularies.
  const guessedEmoji = isEvent ? experienceEmoji(description) : categoryEmoji(description)
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

  const canSubmit = isEvent
    ? description.trim() && !loading
    : description.trim() &&
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

  // OCR a photographed bill or document into the note (and the empty fields),
  // then throw the photo away — nothing but text is ever stored, on either
  // path. An expense reads a bill; an event reads the boarding pass, ticket or
  // booking that the moment left behind.
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setScanning(true)
    setScanError(null)

    if (isEvent) {
      try {
        const doc = await scanDocument(file)
        // A ticket's particulars — seat, coach, class, PNR, gate, platform —
        // read the same here as they do on the expense side, because both
        // scanners return the same block and both format it the same way.
        const travelText = formatTravel(doc.travel)
        if (doc.details || travelText) {
          setNote((prev) => appendToNote(prev, doc.details, travelText))
        }
        if (doc.title && !description.trim()) {
          // Left on "Automatic": a title like "Flight to Hyderabad" now picks
          // its own ✈️ out of the experience lexicon.
          setDescription(doc.title)
        }
        // Only when the date is still the untouched default — a scan should
        // never quietly move an event somebody has already placed on a day.
        if (doc.date && expenseDate === todayStr()) setExpenseDate(doc.date)
        if (!doc.title && !doc.details && !doc.date && !travelText) {
          setScanError('Could not read anything useful from that photo.')
        }
      } catch (err) {
        setScanError(err.message)
      }
      setScanning(false)
      return
    }

    try {
      const result = await scanReceipt(file)
      const travelText = formatTravel(result.travel)
      const scanned = result.summary || result.text
      if (scanned || travelText) {
        setNote((prev) => appendToNote(prev, scanned, travelText))
      }
      if (result.amount > 0 && !amount) setAmount(String(result.amount))
      if (result.merchant && !description.trim()) setDescription(result.merchant)
      // A second scan replaces the rows rather than appending: two photos of
      // the same bill would otherwise silently double the table.
      if (result.items.length) setLineItems(result.items)
      if (!scanned && !travelText && !result.items.length && !(result.amount > 0)) {
        setScanError('Could not read anything useful from that photo.')
      }
    } catch (err) {
      setScanError(err.message)
    }
    setScanning(false)
  }

  // Labels for the Reports tab, decided here so the common case never touches
  // the network. The keyword matcher is authoritative when it hits; when it
  // misses, both columns stay NULL, and NULL is precisely the signal the
  // Reports tab uses to decide what is worth asking Gemini about. Storing
  // "Other/Miscellaneous" instead would make a genuine Other indistinguishable
  // from a description nobody has looked at yet.
  //
  // On an edit, a description that hasn't changed keeps whatever labels it
  // already had — otherwise correcting a typo in the amount would silently
  // undo a hand-picked category.
  const resolveLabels = () => {
    const text = description.trim()
    if (isEdit && !expense._type && text === (expense.description || '').trim()) {
      return { category: expense.category ?? null, subcategory: expense.subcategory ?? null }
    }
    const guess = guessLabelStrings(text)
    return guess.matched
      ? { category: guess.category, subcategory: guess.subcategory }
      : { category: null, subcategory: null }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    try {
      if (isEvent) {
        if (isEdit) {
          await updateEvent(expense.id, trip.id, description.trim(), expenseDate, note.trim(), emoji)
        } else {
          await addEvent(trip.id, description.trim(), expenseDate, note.trim(), emoji)
        }
      } else {
        const splits = buildSplits()
        const extras = {
          lineItems: normaliseLineItems(lineItems),
          ...resolveLabels(),
        }
        if (isEdit) {
          await updateExpense(
            expense.id, trip.id, description.trim(), parsedAmount, paidBy, splits,
            expenseDate, note.trim(), emoji, extras
          )
        } else {
          await addExpense(
            trip.id, description.trim(), parsedAmount, paidBy, splits,
            expenseDate, note.trim(), emoji, extras
          )
        }
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const heading = isEdit
    ? (isEvent ? 'Edit Event' : 'Edit Expense')
    : (isEvent ? 'Add Event' : 'Add Expense')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{heading}</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        {!isEdit && (
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`tab ${!isEvent ? 'active' : ''}`}
              onClick={() => { setMode('expense'); setError(null) }}
            >
              Expense
            </button>
            <button
              type="button"
              className={`tab ${isEvent ? 'active' : ''}`}
              onClick={() => { setMode('event'); setError(null) }}
            >
              Event
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">{isEvent ? 'What happened?' : 'Description'}</label>
            <div className="description-row">
              <input
                className="input"
                placeholder={isEvent ? 'e.g. Sunset at the beach, Train to Goa' : 'e.g. Dinner, Taxi, Hotel'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="emoji-trigger"
                onClick={() => setShowEmojiPicker(true)}
                title={emoji ? 'Change icon' : 'Picked automatically — tap to change'}
                aria-label="Change icon"
              >
                {shownEmoji}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <div className="description-row">
              <textarea
                className="input"
                rows={2}
                placeholder={isEvent
                  ? 'The story worth remembering'
                  : 'Anything worth remembering about this one'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="scan-trigger"
                  onClick={() => setShowScanChoice((v) => !v)}
                  disabled={scanning}
                  title={isEvent
                    ? 'Scan a ticket or boarding pass — the text is saved, the photo is not'
                    : 'Scan a bill — the text is saved, the photo is not'}
                  aria-label={isEvent
                    ? 'Scan a document with the camera or from the gallery'
                    : 'Scan a bill with the camera or from the gallery'}
                  aria-expanded={showScanChoice}
                >
                  {scanning ? <span className="spinner spinner-inline" /> : '📷'}
                </button>
                {showScanChoice && (
                  <div className="scan-choice">
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => { setShowScanChoice(false); cameraInputRef.current?.click() }}
                    >
                      📸 Take photo
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => { setShowScanChoice(false); galleryInputRef.current?.click() }}
                    >
                      🖼️ Choose photo
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* capture asks the OS for the camera directly, which is the
                only reliable way to reach it on Android. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleScanFile}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleScanFile}
            />
            {!scanning && !scanError && (
              <p className="field-hint">
                {isEvent
                  ? '📷 Snap a boarding pass, ticket or booking and the details are read in for you. The photo is never saved — only the text.'
                  : '📷 Snap a bill or invoice and the items, prices and total are read in for you.'}
              </p>
            )}
            {scanning && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {isEvent
                  ? 'Reading the document… the photo itself is never saved.'
                  : 'Reading the bill… the photo itself is never saved.'}
              </p>
            )}
            {scanError && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{scanError}</p>
            )}
            {!isEvent && lineItems.length > 0 && (
              <LineItemsTable
                items={lineItems}
                symbol={symbol}
                amount={parsedAmount}
                editable
                defaultOpen
                onChange={setLineItems}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {!isEvent && (
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
            )}
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

          {!isEvent && !solo && (
            <div>
              <label className="label">Paid by</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {orderedParticipants.map((p) => (
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
          )}

          {!isEvent && !solo && (
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
                {orderedParticipants.map((p) => {
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
          )}

          {!isEvent && !solo && (
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
          )}

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {loading
              ? (isEdit ? 'Saving...' : 'Adding...')
              : (isEdit ? 'Save Changes' : (isEvent ? 'Add Event' : 'Add Expense'))}
          </button>
        </form>
      </div>

      {showEmojiPicker && (
        <EmojiPicker
          title="Pick an icon"
          groups={isEvent ? EVENT_EMOJI_GROUPS : EXPENSE_EMOJI_GROUPS}
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
