/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// The category donut as a plain SVG string, for the exported diary.
//
// It shares donutGeometry.js with the live component, so the printed chart and
// the on-screen one are the same drawing — this file only differs in being
// static: no selection, no explode, literal colours instead of CSS variables
// (an export has to stand on its own in a file with no stylesheet), and every
// slice labelled since there is no tapping to reveal the rest.
//
// This is also the reason the donut was hand-rolled. A canvas-based charting
// library would have needed a rasterisation step to survive into a standalone
// HTML file; an SVG string just goes in.

import { buildArcs, percentLabel, VIEW_W, VIEW_H, CX, CY, R_INNER } from './donutGeometry'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * @param {Object} report - from buildReport()
 * @param {string} symbol - currency symbol
 * @returns {string} an <svg> element, or '' when there is nothing to draw
 */
export function renderDonutSvg(report, symbol) {
  const arcs = buildArcs(report.slices)
  if (!arcs.length) return ''

  const money = (n) =>
    `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const slices = arcs
    .map(
      (arc) =>
        `<path d="${arc.path}" fill="${arc.color}" stroke="#ffffff" stroke-width="2"/>`
    )
    .join('\n    ')

  const labels = arcs
    .filter((arc) => arc.showLabel)
    .map(
      (arc) =>
        `<text x="${arc.labelX}" y="${arc.labelY}" text-anchor="${arc.labelAnchor}" ` +
        `dominant-baseline="middle" font-size="11" font-weight="600" fill="#64748b">` +
        `${percentLabel(arc.share)}</text>`
    )
    .join('\n    ')

  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Spending by category">
    ${slices}
    ${labels}
    <circle cx="${CX}" cy="${CY}" r="${R_INNER - 2}" fill="#ffffff"/>
    <text x="${CX}" y="${CY - 12}" text-anchor="middle" font-size="12" fill="#64748b">Trip total</text>
    <text x="${CX}" y="${CY + 10}" text-anchor="middle" font-size="21" font-weight="700" fill="#1e293b">${esc(money(report.total))}</text>
  </svg>`
}
