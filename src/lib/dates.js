/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Day grouping for the expense list. `expense_date` is a plain DATE string
// ("2026-08-12") and must be read as a local calendar day — parsing it with
// `new Date(str)` treats it as UTC midnight, which lands on the previous day
// in western timezones.

function pad(n) {
  return String(n).padStart(2, '0')
}

function localKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Stable YYYY-MM-DD bucket key for an expense or event. */
export function dayKey(expense) {
  const d = expense.expense_date || expense.event_date
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  if (expense.created_at) return localKey(new Date(expense.created_at))
  return localKey(new Date())
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function ordinal(n) {
  if (n > 3 && n < 21) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/** "Sat, 2nd Aug" — the year is added only when it isn't the current one. */
export function formatDay(key) {
  const date = parseKey(key)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  const thisYear = new Date().getFullYear()
  const yearPart = date.getFullYear() === thisYear ? '' : ` ${date.getFullYear()}`
  return `${weekday}, ${ordinal(date.getDate())} ${month}${yearPart}`
}

/**
 * "Today · Wed, 12th Aug" / "Yesterday · Tue, 11th Aug" / "Sat, 2nd Aug"
 */
export function formatDayHeading(key) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const full = formatDay(key)
  const diffDays = Math.round((today - parseKey(key)) / 86400000)
  if (diffDays === 0) return `Today · ${full}`
  if (diffDays === 1) return `Yesterday · ${full}`
  return full
}

/**
 * Group an already-sorted (newest first) expense list into day buckets,
 * preserving order.
 */
export function groupByDay(expenses) {
  const groups = []
  const index = new Map()

  for (const expense of expenses) {
    const key = dayKey(expense)
    let group = index.get(key)
    if (!group) {
      group = { key, heading: formatDayHeading(key), expenses: [], total: 0 }
      index.set(key, group)
      groups.push(group)
    }
    group.expenses.push(expense)
    // Events carry no amount and must not turn the day total into NaN.
    group.total += Number(expense.amount) || 0
  }

  return groups
}
