/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useMemo, useRef, useState } from 'react'
import useTripStore from '../store/tripStore'
import { buildDiaryHtml } from '../lib/exportDiary'
import { downloadDiaryDoc } from '../lib/exportWord'
import SummarySheet from './SummarySheet'

/**
 * Full-screen preview of the trip diary.
 *
 * The page lives in an iframe (srcDoc) rather than a pop-up tab — phone
 * browsers block window.open often enough that the feature would look broken.
 * Printing targets the iframe's own window, so what prints is the diary
 * alone, not the app around it.
 *
 * Density and order are remembered on the device rather than on the trip: they
 * are how THIS person likes to read a diary, and two people exporting the same
 * trip should not fight over one setting.
 */

const ORDER_KEY = 'splitspend_diary_order'
const DENSITY_KEY = 'splitspend_diary_density'

const readPref = (key, allowed, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // A device with storage disabled just gets the default next time.
  }
}

export default function DiaryPreview({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const events = useTripStore((s) => s.events)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const frameRef = useRef(null)

  const [order, setOrder] = useState(() => readPref(ORDER_KEY, ['forward', 'reverse'], 'forward'))
  const [density, setDensity] = useState(() => readPref(DENSITY_KEY, ['full', 'compact'], 'full'))
  const [showSummary, setShowSummary] = useState(false)

  const options = useMemo(() => ({ order, density }), [order, density])

  const html = useMemo(
    () => buildDiaryHtml(trip, participants, expenses, events, settlementRecords, options),
    [trip, participants, expenses, events, settlementRecords, options]
  )

  const chooseOrder = (value) => { setOrder(value); writePref(ORDER_KEY, value) }
  const chooseDensity = (value) => { setDensity(value); writePref(DENSITY_KEY, value) }

  const handlePrint = () => {
    const win = frameRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }

  return (
    <div className="diary-overlay">
      <div className="diary-bar">
        <button className="btn-ghost" onClick={onClose} aria-label="Close diary">
          &larr; Back
        </button>
        <span className="diary-bar-title">Trip Diary</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Replaces the old raw-HTML download: a Word file is the same
              content in something people can actually edit, and three buttons
              is already as much as a phone bar takes. */}
          <button
            className="btn-ghost"
            onClick={() => downloadDiaryDoc(trip, participants, expenses, events, settlementRecords, options)}
            title="Download an editable Word document"
          >
            Word
          </button>
          <button className="diary-print" onClick={handlePrint}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* How the diary is put together, one row under the bar so the buttons
          above stay reachable with a thumb on a phone. */}
      <div className="diary-options">
        <div className="diary-toggle" role="group" aria-label="Page density">
          <button
            className={density === 'full' ? 'active' : ''}
            onClick={() => chooseDensity('full')}
            title="Full bill tables, one column"
          >
            Full
          </button>
          <button
            className={density === 'compact' ? 'active' : ''}
            onClick={() => chooseDensity('compact')}
            title="Two columns and folded bills when printed — far fewer pages"
          >
            Compact
          </button>
        </div>

        <div className="diary-toggle" role="group" aria-label="Day order">
          <button
            className={order === 'forward' ? 'active' : ''}
            onClick={() => chooseOrder('forward')}
            title="Oldest day first, the way a diary reads"
          >
            Oldest first
          </button>
          <button
            className={order === 'reverse' ? 'active' : ''}
            onClick={() => chooseOrder('reverse')}
            title="Newest day first, the way the app's list reads"
          >
            Newest first
          </button>
        </div>

        <button
          className={`diary-summary-btn ${trip?.summary ? 'has-summary' : ''}`}
          onClick={() => setShowSummary(true)}
          title="A written passage at the top of the diary"
        >
          {trip?.summary ? '✍️ Summary ✓' : '✍️ Summary'}
        </button>
      </div>

      <iframe
        ref={frameRef}
        className="diary-frame"
        title="Trip diary preview"
        srcDoc={html}
      />

      {showSummary && <SummarySheet onClose={() => setShowSummary(false)} />}
    </div>
  )
}
