/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Geometry for the category donut.
//
// Kept apart from React because the same chart has to be drawn twice: once as
// live SVG in the Reports tab, and once as a plain SVG string inside the
// exported diary and Word file. Both call this, so the printed chart and the
// on-screen one can never drift apart.
//
// A hand-rolled donut rather than a charting library: the whole thing is this
// file plus a component, it serialises into a standalone HTML export without a
// rasterisation step, and the app's only other UI dependency stays dnd-kit.

export const VIEW_W = 280
export const VIEW_H = 250
export const CX = 140
export const CY = 125
export const R_OUTER = 88
export const R_INNER = 52
/** How far a tapped slice pulls out of the ring. */
export const EXPLODE = 9
/** Radius the direct labels sit at, clear of the ring. */
const R_LABEL = 104

// ~2px of surface between neighbouring fills at this radius (2/88 rad ≈ 1.3°),
// which is what keeps two similar hues from reading as one shape.
const GAP_DEG = 1.3
// Below this sweep a slice is thinner than the gap it would lose, so it keeps
// its full width instead of vanishing.
const MIN_SWEEP_FOR_GAP = 4

// Labelling every slice is noise; four is the ceiling, and anything under 8%
// has no room for its own number.
const MAX_DIRECT_LABELS = 4
const MIN_SHARE_FOR_LABEL = 0.08

function polar(r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

const fmt = (n) => Math.round(n * 100) / 100

function segmentPath(startAngle, endAngle) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  const o1 = polar(R_OUTER, startAngle)
  const o2 = polar(R_OUTER, endAngle)
  const i2 = polar(R_INNER, endAngle)
  const i1 = polar(R_INNER, startAngle)
  return [
    `M ${fmt(o1.x)} ${fmt(o1.y)}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${fmt(o2.x)} ${fmt(o2.y)}`,
    `L ${fmt(i2.x)} ${fmt(i2.y)}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${fmt(i1.x)} ${fmt(i1.y)}`,
    'Z',
  ].join(' ')
}

/**
 * Turn report slices into drawable arcs.
 *
 * @param {Array} slices - [{ key, label, color, total, share }] in fixed order
 * @returns {Array} the same entries plus { path, midAngle, dx, dy, label position }
 */
export function buildArcs(slices) {
  const sum = slices.reduce((s, x) => s + x.share, 0)
  if (sum <= 0) return []

  // A single category filling the whole ring would ask for an arc from 0° to
  // 360°, whose endpoints coincide and which therefore draws nothing. Stopping
  // a hair short keeps it a visible ring; the seam is under a pixel wide.
  const scale = 359.99 / sum

  const ranked = [...slices]
    .map((s, i) => ({ i, share: s.share }))
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_DIRECT_LABELS)
    .filter((s) => s.share >= MIN_SHARE_FOR_LABEL)
  const labelled = new Set(ranked.map((s) => s.i))

  let cursor = 0
  return slices.map((slice, index) => {
    const sweep = slice.share * scale
    const start = cursor
    const end = cursor + sweep
    cursor = end

    const pad = sweep > MIN_SWEEP_FOR_GAP ? GAP_DEG / 2 : 0
    const midAngle = start + sweep / 2
    const push = polar(EXPLODE, midAngle)

    const labelPoint = polar(R_LABEL, midAngle)
    const onLeft = midAngle > 180

    return {
      ...slice,
      path: segmentPath(start + pad, end - pad),
      midAngle,
      // Offset applied when the slice is the selected one.
      dx: fmt(push.x - CX),
      dy: fmt(push.y - CY),
      showLabel: labelled.has(index),
      labelX: fmt(labelPoint.x),
      labelY: fmt(labelPoint.y),
      labelAnchor: onLeft ? 'end' : 'start',
    }
  })
}

/** Whole percent, with anything visible but tiny shown as <1% rather than 0%. */
export function percentLabel(share) {
  const pct = share * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}
