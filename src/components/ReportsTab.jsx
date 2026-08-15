/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import useTripStore from '../store/tripStore'
import { currencySymbol } from '../lib/currency'
import { buildReport } from '../lib/reportData'
import { localLabels, remoteLabels, unlabelledExpenses } from '../lib/autoCategorise'
import { labelFor } from '../lib/categories'
import CategoryPicker from './CategoryPicker'
import CategoryDonut from './CategoryDonut'

/**
 * Where the trip's money went.
 *
 * Labels are filled in on first open — offline keyword match first, then one
 * batched Gemini call for whatever is left — and written back, so a trip only
 * ever pays that cost once. Every figure on this tab is summed in the browser
 * from the stored expense amounts; the model contributes two strings per
 * expense and nothing else.
 *
 * Two taps deep: a slice narrows the breakdown to one head, a subcategory row
 * opens the expenses inside it. That list stands where "Fix a category" used
 * to — the correction now lives on the expense card itself, and on any row
 * here, rather than in a separate list of every expense in the trip.
 */
export default function ReportsTab() {
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const setExpenseLabels = useTripStore((s) => s.setExpenseLabels)
  const symbol = currencySymbol(trip?.currency)

  const [selectedKey, setSelectedKey] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null) // { categoryKey, subKey }
  const [labelling, setLabelling] = useState(false)
  const [labelError, setLabelError] = useState(null)
  const [editing, setEditing] = useState(null) // the expense whose picker is open
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

  const chooseCategory = (key) => {
    setSelectedKey(key)
    setSelectedSub(null)
  }

  const toggleSub = (categoryKey, subKey) => {
    setSelectedSub((current) =>
      current && current.categoryKey === categoryKey && current.subKey === subKey
        ? null
        : { categoryKey, subKey })
  }

  // The expenses behind a subcategory row, read straight off the same labels
  // the totals were grouped by — so what opens always sums to what was tapped.
  const openCategory = selectedSub
    ? report.categories.find((c) => c.key === selectedSub.categoryKey)
    : null
  const openSub = openCategory?.subs.find((s) => s.key === selectedSub.subKey)
  const openExpenses = selectedSub
    ? expenses.filter((expense) => {
        const label = labelFor(expense)
        return label.category.key === selectedSub.categoryKey
          && label.sub.key === selectedSub.subKey
      })
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="card-heading">Where the money went</div>
        <CategoryDonut
          report={report}
          symbol={symbol}
          selectedKey={selectedKey}
          onSelect={chooseCategory}
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
            onClick={() => chooseCategory(null)}
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
            {category.subs.map((sub) => {
              const open = selectedSub
                && selectedSub.categoryKey === category.key
                && selectedSub.subKey === sub.key
              return (
                <button
                  key={sub.key}
                  type="button"
                  className={`report-sub-row ${open ? 'open' : ''}`}
                  onClick={() => toggleSub(category.key, sub.key)}
                  aria-expanded={open}
                >
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
                </button>
              )
            })}
          </div>
        ))}

        {!selectedSub && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
            Tap a subcategory to see the expenses inside it.
          </p>
        )}
      </div>

      {/* What's inside the subcategory that was tapped. This is the space the
          old "Fix a category" list occupied; the correction it offered now
          lives on every row here and on the cards themselves. */}
      {selectedSub && openSub && (
        <div className="card">
          <div className="card-heading">
            {openSub.emoji} {openSub.label}
            <span className="report-group-total">
              {symbol}{openSub.total.toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            {openExpenses.length} expense{openExpenses.length === 1 ? '' : 's'} in {openCategory.label} · tap one to move it somewhere else.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {openExpenses.map((expense) => (
              <button
                key={expense.id}
                type="button"
                className="report-fix-row"
                onClick={() => setEditing(expense)}
              >
                <span className="report-fix-name">{expense.description}</span>
                <span className="report-fix-tag">
                  {symbol}{Number(expense.amount).toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 13, padding: '8px 0 0', color: 'var(--color-text-muted)' }}
            onClick={() => setSelectedSub(null)}
          >
            Close
          </button>
        </div>
      )}

      {editing && (
        <CategoryPicker expense={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
