/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import useTripStore from '../store/tripStore'
import { currencySymbol } from '../lib/currency'
import { buildReport } from '../lib/reportData'
import { localLabels, remoteLabels, unlabelledExpenses } from '../lib/autoCategorise'
import { TAXONOMY } from '../lib/taxonomy'
import CategoryDonut from './CategoryDonut'

/**
 * Where the trip's money went.
 *
 * Labels are filled in on first open — offline keyword match first, then one
 * batched Gemini call for whatever is left — and written back, so a trip only
 * ever pays that cost once. Every figure on this tab is summed in the browser
 * from the stored expense amounts; the model contributes two strings per
 * expense and nothing else.
 */
export default function ReportsTab() {
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const setExpenseLabels = useTripStore((s) => s.setExpenseLabels)
  const symbol = currencySymbol(trip?.currency)

  const [selectedKey, setSelectedKey] = useState(null)
  const [labelling, setLabelling] = useState(false)
  const [labelError, setLabelError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  // One labelling pass per trip per mount. Without this the effect would fire
  // again on the refresh its own writes trigger.
  const attemptedRef = useRef(null)

  const report = useMemo(() => buildReport(expenses), [expenses])

  useEffect(() => {
    if (!trip?.id || attemptedRef.current === trip.id) return
    if (!unlabelledExpenses(expenses).length) return
    attemptedRef.current = trip.id

    let cancelled = false
    ;(async () => {
      // The offline pass is written first and on its own. If the network leg
      // then fails, the keyword labels are already saved rather than being
      // lost along with it.
      try {
        const local = localLabels(expenses)
        if (local.length && !cancelled) await setExpenseLabels(trip.id, local)
      } catch {
        // A failed write just means the guesses render without persisting.
      }

      if (cancelled) return
      setLabelling(true)
      try {
        const remote = await remoteLabels(expenses)
        if (remote.length && !cancelled) await setExpenseLabels(trip.id, remote)
      } catch (err) {
        // Unlabelled expenses still appear — buildReport falls back to the
        // offline guess — so this is a note, not a failure state.
        if (!cancelled) setLabelError(err.message)
      }
      if (!cancelled) setLabelling(false)
    })()

    return () => { cancelled = true }
  }, [trip?.id, expenses, setExpenseLabels])

  const handleRecategorise = async (expense, categoryLabel, subLabel) => {
    setEditingId(null)
    try {
      await setExpenseLabels(trip.id, [
        { id: expense.id, category: categoryLabel, subcategory: subLabel },
      ])
    } catch (err) {
      setLabelError(err.message)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>Nothing to report yet</p>
        <p style={{ fontSize: 13 }}>Add an expense and the breakdown appears here.</p>
      </div>
    )
  }

  const selectedCategory = report.categories.find((c) => c.key === selectedKey)
  // A slice can stand for several folded-in heads, so opening it shows all of
  // them rather than only the one whose name is on the legend.
  const shownCategories = selectedCategory
    ? [selectedCategory]
    : report.categories

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-heading">Where the money went</div>
        <CategoryDonut
          report={report}
          symbol={symbol}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
        {labelling && (
          <p className="report-note">
            <span className="spinner spinner-inline" /> Sorting the last few expenses into categories…
          </p>
        )}
        {labelError && !labelling && (
          <p className="report-note">
            Some expenses are grouped by keyword only — {labelError}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-heading">
          {selectedCategory ? selectedCategory.label : 'Breakdown'}
        </div>
        {selectedCategory && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 13, padding: '2px 0', marginBottom: 8, color: 'var(--color-text-muted)' }}
            onClick={() => setSelectedKey(null)}
          >
            ← All categories
          </button>
        )}

        {shownCategories.map((category) => (
          <div key={category.key} className="report-group">
            <div className="report-group-head">
              <span className="donut-swatch" style={{ background: category.color }} aria-hidden="true" />
              <span style={{ fontWeight: 600 }}>{category.emoji} {category.label}</span>
              <span className="report-group-total">
                {symbol}{category.total.toLocaleString()}
              </span>
            </div>
            {category.subs.map((sub) => (
              <div key={sub.key} className="report-sub-row">
                <span className="report-sub-name">{sub.emoji} {sub.label}</span>
                {/* A bar rather than a second colour: this is magnitude
                    within one head, so it stays in that head's own hue. */}
                <span className="report-bar" aria-hidden="true">
                  <span
                    className="report-bar-fill"
                    style={{ width: `${Math.max(2, sub.share * 100)}%`, background: category.color }}
                  />
                </span>
                <span className="report-sub-value">
                  {symbol}{sub.total.toLocaleString()}
                  <span className="report-sub-count"> · {sub.count}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* The manual override. Whatever a model decided, the last word belongs
          to whoever is looking at the trip. */}
      <div className="card">
        <div className="card-heading">Fix a category</div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Tap an expense to move it to a different heading.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expenses.map((expense) => {
            const shown = buildReport([expense]).categories[0]
            return (
              <div key={expense.id}>
                <button
                  type="button"
                  className="report-fix-row"
                  onClick={() => setEditingId(editingId === expense.id ? null : expense.id)}
                  aria-expanded={editingId === expense.id}
                >
                  <span className="report-fix-name">{expense.description}</span>
                  <span className="report-fix-tag">
                    {shown ? `${shown.emoji} ${shown.subs[0].label}` : '—'}
                  </span>
                </button>
                {editingId === expense.id && (
                  <div className="report-picker">
                    {TAXONOMY.map((category) => (
                      <div key={category.key} className="report-picker-group">
                        <div className="report-picker-head">{category.emoji} {category.label}</div>
                        <div className="report-picker-subs">
                          {category.subs.map((sub) => (
                            <button
                              key={sub.key}
                              type="button"
                              className="report-picker-chip"
                              onClick={() => handleRecategorise(expense, category.label, sub.label)}
                            >
                              {sub.emoji} {sub.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
