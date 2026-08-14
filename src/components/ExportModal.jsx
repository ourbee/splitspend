/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import useTripStore from '../store/tripStore'
import { exportTripToCSV, downloadCSV } from '../lib/exportData'

export default function ExportModal({ onClose, onOpenDiary }) {
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const events = useTripStore((s) => s.events)
  const settlementRecords = useTripStore((s) => s.settlementRecords)

  const handleExportCSV = () => {
    const csv = exportTripToCSV(trip, participants, expenses, events, settlementRecords)
    const filename = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_splitspend.csv`
    downloadCSV(csv, filename)
  }

  const handleExportJSON = () => {
    const data = {
      trip: {
        name: trip.name,
        currency: trip.currency,
        created_at: trip.created_at,
      },
      participants: participants.map(p => ({
        name: p.name,
      })),
      expenses: expenses.map(exp => ({
        description: exp.description,
        amount: Number(exp.amount),
        paid_by: participants.find(p => p.id === exp.paid_by)?.name || 'Unknown',
        added_by: participants.find(p => p.id === exp.created_by)?.name || null,
        split_among: exp.splits.map(s => ({
          name: participants.find(p => p.id === s.participant_id)?.name || 'Unknown',
          share: Number(s.share_amount),
        })),
        date: exp.expense_date || exp.created_at,
      })),
      events: events.map(ev => ({
        title: ev.title,
        note: ev.note || null,
        added_by: participants.find(p => p.id === ev.created_by)?.name || null,
        date: ev.event_date || ev.created_at,
      })),
      settlement_records: settlementRecords.map(rec => ({
        from: participants.find(p => p.id === rec.from_participant)?.name || 'Unknown',
        to: participants.find(p => p.id === rec.to_participant)?.name || 'Unknown',
        amount: Number(rec.amount),
        date: rec.settled_at,
      })),
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_splitspend.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Export Data</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
          Download all expenses, events, balances, and settlement records for "{trip.name}"
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={onOpenDiary}>
            Trip Diary
          </button>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            Export as CSV
          </button>
          <button className="btn btn-secondary" onClick={handleExportJSON}>
            Export as JSON
          </button>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 12 }}>
          The diary is a keepsake page — the day-by-day story with notes and
          events, then an invoice-style statement. Print it, save it as a PDF,
          or keep the file.
        </p>
      </div>
    </div>
  )
}
