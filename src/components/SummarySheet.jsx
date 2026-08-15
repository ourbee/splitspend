/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useMemo, useState } from 'react'
import useTripStore from '../store/tripStore'
import {
  buildSummaryFacts, summaryFingerprint, summaryIsStale, wordBudget, writeSummary,
} from '../lib/tripSummary'

/**
 * The trip's written summary — the paragraph the diary opens with.
 *
 * Three deliberate properties, all of them the point of the feature:
 *
 *   * It is written only when somebody presses the button. Opening a trip, or
 *     even opening the diary, never calls a model.
 *   * What comes back is a draft in a text box, not a fact. It can be edited,
 *     rewritten or deleted, and the edit is what gets stored.
 *   * The fingerprint of the trip it was written from is stored beside it, so
 *     a summary written before three more days of expenses says so instead of
 *     quietly describing a trip that no longer exists.
 */
export default function SummarySheet({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const events = useTripStore((s) => s.events)
  const setTripSummary = useTripStore((s) => s.setTripSummary)

  const facts = useMemo(
    () => buildSummaryFacts(trip, participants, expenses, events),
    [trip, participants, expenses, events]
  )

  const [text, setText] = useState(trip?.summary || '')
  const [busy, setBusy] = useState(null) // 'writing' | 'saving' | null
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const stale = summaryIsStale(trip, facts)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const dirty = text.trim() !== (trip?.summary || '').trim()
  const nothingToWrite = facts.days.length === 0

  const handleWrite = async () => {
    setBusy('writing')
    setError(null)
    setSaved(false)
    try {
      const written = await writeSummary(facts)
      setText(written)
      // Saved straight away: the trip it was written from is exactly the one
      // in hand, so this is the moment the fingerprint is honest.
      await setTripSummary(trip.id, written, summaryFingerprint(facts))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  const handleSave = async () => {
    setBusy('saving')
    setError(null)
    try {
      await setTripSummary(trip.id, text, text.trim() ? summaryFingerprint(facts) : null)
      setSaved(true)
    } catch (err) {
      // The store applied the text locally before the write, so the diary
      // still shows it — this only means it will not survive a reload.
      setError(`${err.message} — the text is in this diary but was not saved.`)
    }
    setBusy(null)
  }

  const handleRemove = async () => {
    setBusy('saving')
    setError(null)
    try {
      await setTripSummary(trip.id, null, null)
      setText('')
      setSaved(false)
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 130 }} onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>The trip, in words</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }} aria-label="Close">
            &times;
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          A short passage for the top of the diary, written from your own days,
          notes and bills — about {wordBudget(facts)} words for this trip.
          Nobody's name is sent; the paragraph speaks as "we". Edit it as much
          as you like: what you keep here is what prints.
        </p>

        {stale && !dirty && (
          <p className="summary-flag">
            The trip has changed since this was written — rewrite it to bring it up to date.
          </p>
        )}

        <textarea
          className="input"
          rows={10}
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false) }}
          placeholder={nothingToWrite
            ? 'Add an expense or an event first — there is nothing to write about yet.'
            : 'Press "Write it for me", or type your own.'}
          style={{ resize: 'vertical', lineHeight: 1.55 }}
        />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6, minHeight: 18,
        }}>
          <span>{words > 0 ? `${words} words` : ''}</span>
          {saved && !dirty && <span>Saved ✓</span>}
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button
            className="btn btn-secondary"
            onClick={handleWrite}
            disabled={!!busy || nothingToWrite}
          >
            {busy === 'writing'
              ? <><span className="spinner spinner-inline" /> Writing…</>
              : (text.trim() ? 'Write it again' : 'Write it for me')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!!busy || !dirty}
          >
            {busy === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {trip?.summary && (
            <button
              className="btn-ghost"
              onClick={handleRemove}
              disabled={!!busy}
              style={{ fontSize: 13, color: 'var(--color-text-muted)' }}
            >
              Remove the summary
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
