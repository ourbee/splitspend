/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Soft per-person colours, assigned by position in the participant list
// (which the server returns ordered by created_at) so everyone in the group
// sees the same person in the same colour on every device.
//
// `tint` is a near-white card fill — the default body text stays well above
// WCAG AAA contrast on it. `accent` carries the actual identification, as a
// left stripe on the card and a dot beside the name.
const PALETTE = [
  { accent: '#3b82f6', tint: '#eff6ff' }, // blue
  { accent: '#22c55e', tint: '#f0fdf4' }, // green
  { accent: '#8b5cf6', tint: '#f5f3ff' }, // violet
  { accent: '#f59e0b', tint: '#fffbeb' }, // amber
  { accent: '#ec4899', tint: '#fdf2f8' }, // pink
  { accent: '#14b8a6', tint: '#f0fdfa' }, // teal
  { accent: '#ef4444', tint: '#fef2f2' }, // red
  { accent: '#84cc16', tint: '#f7fee7' }, // lime
  { accent: '#06b6d4', tint: '#ecfeff' }, // cyan
  { accent: '#d946ef', tint: '#fdf4ff' }, // fuchsia
]

const FALLBACK = { accent: 'var(--color-border)', tint: 'var(--color-surface)' }

export function personColor(index) {
  if (index == null || index < 0) return FALLBACK
  return PALETTE[index % PALETTE.length]
}

export function personColorById(participants, id) {
  return personColor(participants.findIndex((p) => p.id === id))
}
