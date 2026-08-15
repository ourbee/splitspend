/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { TAXONOMY } from '../lib/taxonomy'
import { labelFor } from '../lib/categories'

/**
 * Move an expense to a different heading.
 *
 * Opened from the chip on an expense card and from the Reports breakdown, so
 * the correction is always one tap from wherever the wrong category is being
 * looked at. Whatever a keyword matcher or a model decided, the last word
 * belongs to whoever is looking at the trip — and "Automatic" hands the
 * decision back, which is not the same as choosing Other.
 *
 * Only labels travel through this path: no amount, split or date can be
 * reached, so a mislabelled expense is always a cosmetic problem and never a
 * financial one.
 */
export default function CategoryPicker({ expense, onClose }) {
  const trip = useTripStore((s) => s.trip)
  const setExpenseLabels = useTripStore((s) => s.setExpenseLabels)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const current = labelFor(expense)

  const apply = async (categoryLabel, subLabel) => {
    setSaving(true)
    setError(null)
    try {
      await setExpenseLabels(trip.id, [
        { id: expense.id, category: categoryLabel, subcategory: subLabel },
      ])
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 120 }}
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Category</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }} aria-label="Close">
            &times;
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          {expense.description} — currently {current.sub.emoji} {current.sub.label}
          {current.stored ? '' : ' (guessed from the description)'}
        </p>

        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>
        )}

        {current.stored && (
          <button
            type="button"
            className="report-picker-chip"
            style={{ marginBottom: 12 }}
            disabled={saving}
            onClick={() => apply(null, null)}
          >
            ↩︎ Back to automatic
          </button>
        )}

        <div className="report-picker" style={{ padding: 0 }}>
          {TAXONOMY.map((category) => (
            <div key={category.key} className="report-picker-group">
              <div className="report-picker-head">{category.emoji} {category.label}</div>
              <div className="report-picker-subs">
                {category.subs.map((sub) => {
                  const selected = current.stored
                    && current.category.key === category.key
                    && current.sub.key === sub.key
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`report-picker-chip ${selected ? 'selected' : ''}`}
                      disabled={saving}
                      onClick={() => apply(category.label, sub.label)}
                    >
                      {sub.emoji} {sub.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
