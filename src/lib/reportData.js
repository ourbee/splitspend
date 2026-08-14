/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Every number the Reports tab shows is computed here, in the browser, from
// the stored expense amounts. No model is ever asked to add anything up — its
// only contribution upstream is the two label strings this file groups by.
// That separation is the whole design: a mislabelled expense moves a slice
// from one head to another, and can never change a total.

import { round2 } from './splits'
import { TAXONOMY, OTHER_CATEGORY, resolveLabel } from './taxonomy'
import { guessLabelStrings } from './categories'

// A donut stops being readable past about six slices. The heads beyond that
// fold into Other for the chart only — the breakdown underneath always lists
// every category at full detail, which is also the relief the palette's
// low-contrast slots require.
const MAX_SLICES = 6

/**
 * Group a trip's expenses by category and subcategory.
 *
 * Expenses with no stored label fall back to the offline guess, so the report
 * is never blank while the labelling round-trip is still in flight.
 *
 * @returns {{ total, categories, slices, unlabelled }}
 *   categories — every head with a non-zero total, in taxonomy order, each
 *                with its own subcategory rows sorted big-to-small
 *   slices     — the same data capped to MAX_SLICES for the donut
 */
export function buildReport(expenses) {
  const byCategory = new Map()
  let total = 0
  let unlabelled = 0

  for (const expense of expenses) {
    const amount = Number(expense.amount)
    if (!Number.isFinite(amount)) continue

    let categoryLabel = expense.category
    let subLabel = expense.subcategory
    if (!categoryLabel) {
      const guess = guessLabelStrings(expense.description)
      categoryLabel = guess.category
      subLabel = guess.subcategory
      unlabelled += 1
    }

    const { category, sub } = resolveLabel(categoryLabel, subLabel)

    if (!byCategory.has(category.key)) {
      byCategory.set(category.key, {
        key: category.key,
        label: category.label,
        emoji: category.emoji,
        color: category.color,
        total: 0,
        count: 0,
        subs: new Map(),
      })
    }
    const entry = byCategory.get(category.key)
    entry.total += amount
    entry.count += 1

    if (!entry.subs.has(sub.key)) {
      entry.subs.set(sub.key, { key: sub.key, label: sub.label, emoji: sub.emoji, total: 0, count: 0 })
    }
    const subEntry = entry.subs.get(sub.key)
    subEntry.total += amount
    subEntry.count += 1

    total += amount
  }

  // Taxonomy order, not size order — a category keeps its colour and its place
  // whatever the numbers do.
  const categories = TAXONOMY
    .map((c) => byCategory.get(c.key))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      total: round2(entry.total),
      share: total > 0 ? entry.total / total : 0,
      subs: [...entry.subs.values()]
        .map((s) => ({
          ...s,
          total: round2(s.total),
          share: entry.total > 0 ? s.total / entry.total : 0,
        }))
        .sort((a, b) => b.total - a.total),
    }))

  return {
    total: round2(total),
    categories,
    slices: buildSlices(categories, total),
    unlabelled,
  }
}

/**
 * Cap the chart at MAX_SLICES, folding the smallest heads into Other.
 *
 * Other is never itself folded away, and the fold only ever happens when there
 * genuinely are more heads than the chart can carry — with seven categories in
 * the taxonomy that is at most one small head, and it is still listed in full
 * in the breakdown below the chart.
 */
function buildSlices(categories, total) {
  if (categories.length <= MAX_SLICES) {
    return categories.map((c) => ({
      key: c.key, label: c.label, emoji: c.emoji, color: c.color,
      total: c.total, share: c.share, folded: [],
    }))
  }

  const other = categories.find((c) => c.key === OTHER_CATEGORY.key)
  const rest = categories.filter((c) => c.key !== OTHER_CATEGORY.key)
  const bySize = [...rest].sort((a, b) => b.total - a.total)

  const keepCount = other ? MAX_SLICES - 1 : MAX_SLICES
  const kept = new Set(bySize.slice(0, keepCount).map((c) => c.key))
  const folded = bySize.slice(keepCount)

  const slices = categories
    .filter((c) => kept.has(c.key))
    .map((c) => ({
      key: c.key, label: c.label, emoji: c.emoji, color: c.color,
      total: c.total, share: c.share, folded: [],
    }))

  const foldedTotal = folded.reduce((sum, c) => sum + c.total, 0)
  const otherTotal = round2((other?.total || 0) + foldedTotal)
  if (otherTotal > 0) {
    slices.push({
      key: OTHER_CATEGORY.key,
      label: OTHER_CATEGORY.label,
      emoji: OTHER_CATEGORY.emoji,
      color: OTHER_CATEGORY.color,
      total: otherTotal,
      share: total > 0 ? otherTotal / total : 0,
      folded: folded.map((c) => c.label),
    })
  }

  return slices
}
