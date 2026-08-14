/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useMemo, useRef } from 'react'
import useTripStore from '../store/tripStore'
import { buildDiaryHtml } from '../lib/exportDiary'
import { downloadDiaryDoc } from '../lib/exportWord'

/**
 * Full-screen preview of the trip diary.
 *
 * The page lives in an iframe (srcDoc) rather than a pop-up tab — phone
 * browsers block window.open often enough that the feature would look broken.
 * Printing targets the iframe's own window, so what prints is the diary
 * alone, not the app around it.
 */
export default function DiaryPreview({ onClose }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const events = useTripStore((s) => s.events)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const frameRef = useRef(null)

  const html = useMemo(
    () => buildDiaryHtml(trip, participants, expenses, events, settlementRecords),
    [trip, participants, expenses, events, settlementRecords]
  )

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
            onClick={() => downloadDiaryDoc(trip, participants, expenses, events, settlementRecords)}
            title="Download an editable Word document"
          >
            Word
          </button>
          <button className="diary-print" onClick={handlePrint}>
            Print / PDF
          </button>
        </div>
      </div>
      <iframe
        ref={frameRef}
        className="diary-frame"
        title="Trip diary preview"
        srcDoc={html}
      />
    </div>
  )
}
