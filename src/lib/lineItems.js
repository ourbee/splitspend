/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Bill rows read off a photograph.
//
// The one rule that governs this whole file: **line items are a record, never
// an input to the maths.** Every balance, share and settlement in the app is
// computed from expenses.amount alone. A crumpled thermal receipt misread by a
// vision model must never be able to move what somebody owes — so nothing here
// feeds splits.js, and the sum below exists only to *warn* a human that the
// rows and the total disagree, never to fix either.

import { round2 } from './splits'

/** Coerce one row into the stored shape, or null if it isn't usable. */
function normaliseItem(item) {
  const name = String(item?.name ?? '').trim().slice(0, 120)
  if (!name) return null

  const qtyRaw = item?.qty == null ? '' : String(item.qty).trim().slice(0, 24)
  const unit = Number(item?.unit_price)
  const amount = Number(item?.amount)

  return {
    name,
    qty: qtyRaw || null,
    unit_price: Number.isFinite(unit) && unit > 0 ? round2(unit) : null,
    amount: Number.isFinite(amount) && amount > 0 ? round2(amount) : null,
  }
}

/**
 * Clean a whole list. Returns null rather than [] when nothing survives, so
 * "this expense has a bill attached" is one truthiness check everywhere.
 */
export function normaliseLineItems(items) {
  if (!Array.isArray(items)) return null
  const out = items.map(normaliseItem).filter(Boolean).slice(0, 200)
  return out.length ? out : null
}

/**
 * What the rows add up to. A row with no line total falls back to
 * qty × unit_price only when the quantity is a plain number — "1 kg" is not
 * something to multiply by, and guessing would be exactly the kind of
 * invented arithmetic this feature must not do.
 */
export function lineItemsTotal(items) {
  if (!Array.isArray(items)) return 0
  let sum = 0
  for (const item of items) {
    if (item.amount != null) {
      sum += Number(item.amount)
      continue
    }
    const qty = Number(String(item.qty ?? '').trim())
    if (item.unit_price != null && Number.isFinite(qty) && qty > 0) {
      sum += Number(item.unit_price) * qty
    }
  }
  return round2(sum)
}

/**
 * Compare the rows against the amount actually entered.
 *
 * Returns null when there is nothing meaningful to say — no rows, no total, or
 * the two already agree within a rupee. Anything else is a hint for a person
 * to look at, not an error: bills legitimately differ from their line items by
 * tax, service charge or a discount.
 */
export function lineItemsMismatch(items, amount) {
  const total = lineItemsTotal(items)
  const paid = Number(amount)
  if (!total || !Number.isFinite(paid) || paid <= 0) return null
  const difference = round2(paid - total)
  if (Math.abs(difference) < 1) return null
  return { itemsTotal: total, amount: round2(paid), difference }
}
