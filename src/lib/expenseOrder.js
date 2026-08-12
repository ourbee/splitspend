/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { dayKey } from './dates'

// Mirrors the ORDER BY in get_trip_data: newest day first, then the
// hand-arranged order within the day, with created_at as the tiebreak for
// rows that predate sort_order (before the v5 migration runs, every
// sort_order is undefined and this degrades to the old newest-first order).
export function compareExpenses(a, b) {
  const dayA = dayKey(a)
  const dayB = dayKey(b)
  if (dayA !== dayB) return dayA < dayB ? 1 : -1

  const orderA = a.sort_order
  const orderB = b.sort_order
  if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB
  if (orderA != null && orderB == null) return -1
  if (orderA == null && orderB != null) return 1

  return String(b.created_at || '').localeCompare(String(a.created_at || ''))
}

export function sortExpenses(expenses) {
  return [...expenses].sort(compareExpenses)
}

const STEP = 1000

/**
 * The sort_order for a card dropped at `index` within its day.
 *
 * `dayExpenses` is the day's list *after* the move, so the neighbours either
 * side of `index` are the ones it must land between. Taking the midpoint means
 * one row is written instead of renumbering the day; the RPC rebalances if the
 * gaps ever get too tight.
 */
export function positionFor(dayExpenses, index) {
  const prev = index > 0 ? dayExpenses[index - 1]?.sort_order : null
  const next = index < dayExpenses.length - 1 ? dayExpenses[index + 1]?.sort_order : null

  if (prev == null && next == null) return STEP
  if (prev == null) return next - STEP
  if (next == null) return prev + STEP
  return (prev + next) / 2
}
