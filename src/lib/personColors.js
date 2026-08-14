/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Soft per-person colours.
//
// A person either has a chosen slot (participants.color) or is assigned one
// automatically. Assignment is deterministic from the participant list — which
// the server returns ordered by created_at — so everyone in the group sees the
// same person in the same colour on every device.
//
// `tint` is a near-white card fill; the default body text stays well above
// WCAG AAA contrast on all of them. `accent` carries the identification, as a
// left stripe on the card and a dot beside the name. Only these vetted pairs
// are ever selectable — that is what guarantees legibility, rather than
// validating a freeform colour picker after the fact.
// `deep` is a darker cut of the same hue, used as the button/interface colour
// when this person's colour themes their own device — the accents are tuned
// for thin stripes and dots, but several (amber, lime) are too light to carry
// white button text; the deeps all can.
const PALETTE = [
  { name: 'Blue', accent: '#3b82f6', tint: '#eff6ff', deep: '#2563eb' },
  { name: 'Green', accent: '#22c55e', tint: '#f0fdf4', deep: '#16a34a' },
  { name: 'Violet', accent: '#8b5cf6', tint: '#f5f3ff', deep: '#7c3aed' },
  { name: 'Amber', accent: '#f59e0b', tint: '#fffbeb', deep: '#b45309' },
  { name: 'Pink', accent: '#ec4899', tint: '#fdf2f8', deep: '#db2777' },
  { name: 'Teal', accent: '#14b8a6', tint: '#f0fdfa', deep: '#0d9488' },
  { name: 'Red', accent: '#ef4444', tint: '#fef2f2', deep: '#dc2626' },
  { name: 'Lime', accent: '#84cc16', tint: '#f7fee7', deep: '#4d7c0f' },
  { name: 'Cyan', accent: '#06b6d4', tint: '#ecfeff', deep: '#0e7490' },
  { name: 'Fuchsia', accent: '#d946ef', tint: '#fdf4ff', deep: '#c026d3' },
  { name: 'Indigo', accent: '#6366f1', tint: '#eef2ff', deep: '#4f46e5' },
  { name: 'Orange', accent: '#f97316', tint: '#fff7ed', deep: '#ea580c' },
  { name: 'Emerald', accent: '#10b981', tint: '#ecfdf5', deep: '#059669' },
  { name: 'Rose', accent: '#f43f5e', tint: '#fff1f2', deep: '#e11d48' },
  { name: 'Sky', accent: '#0ea5e9', tint: '#f0f9ff', deep: '#0369a1' },
  { name: 'Purple', accent: '#a855f7', tint: '#faf5ff', deep: '#9333ea' },
]

const FALLBACK = { name: 'None', accent: 'var(--color-border)', tint: 'var(--color-surface)' }

export const PALETTE_SIZE = PALETTE.length

/**
 * Deterministic participant order.
 *
 * create_trip_v4 inserts a group's participants inside one transaction, so
 * `now()` stamps every one of them with an identical created_at. Ordering by
 * created_at alone is therefore a total tie, and the database is free to hand
 * them back in a different order from one query plan to the next — which
 * silently reshuffles every automatically assigned colour. Sorting by id as
 * the tiebreak pins the order for good, whatever the server returns.
 */
export function sortParticipants(participants = []) {
  return [...participants].sort((a, b) => {
    const at = String(a.created_at || '')
    const bt = String(b.created_at || '')
    if (at !== bt) return at < bt ? -1 : 1
    return String(a.id).localeCompare(String(b.id))
  })
}

export function paletteEntry(slot) {
  if (slot == null || slot < 0) return FALLBACK
  return PALETTE[slot % PALETTE.length]
}

export function paletteSwatches() {
  return PALETTE.map((c, slot) => ({ slot, ...c }))
}

/**
 * Work out every person's palette slot in one pass.
 *
 * Chosen slots are honoured first; everyone else takes the lowest slot no one
 * else holds, in list order. That keeps automatic colours stable and stops an
 * auto-assigned person from silently sharing a colour with someone who picked
 * it deliberately.
 *
 * @param {Array} participants - [{ id, color }]
 * @returns {Object} { [participantId]: slot }
 */
export function resolveColorSlots(participants = []) {
  const slots = {}
  const taken = new Set()

  for (const p of participants) {
    if (p.color != null && p.color >= 0) {
      const slot = Number(p.color) % PALETTE.length
      slots[p.id] = slot
      taken.add(slot)
    }
  }

  let next = 0
  for (const p of participants) {
    if (slots[p.id] != null) continue
    // Groups bigger than the palette wrap around and start sharing again,
    // which is what already happens today.
    while (taken.has(next) && taken.size < PALETTE.length) next++
    const slot = next % PALETTE.length
    slots[p.id] = slot
    taken.add(slot)
    next++
  }

  return slots
}

/**
 * CSS variable overrides that re-skin the interface chrome (buttons, tabs,
 * the + button…) in one person's colour — applied on THEIR device only, at
 * the page container, so nothing about how others see the group changes.
 * Card tints are driven per-expense by paletteEntry and are untouched.
 */
export function personTheme(slot) {
  if (slot == null || slot < 0) return {}
  const c = PALETTE[slot % PALETTE.length]
  return {
    '--color-primary': c.deep,
    '--color-primary-hover': `color-mix(in srgb, ${c.deep} 85%, black)`,
    '--color-primary-light': c.tint,
  }
}

/** Slots already spoken for by someone other than `participantId`. */
export function takenSlots(participants = [], participantId = null) {
  const slots = resolveColorSlots(participants)
  return new Set(
    participants
      .filter((p) => p.id !== participantId)
      .map((p) => slots[p.id])
      .filter((s) => s != null)
  )
}
