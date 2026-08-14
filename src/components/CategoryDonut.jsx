/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import {
  buildArcs, percentLabel,
  VIEW_W, VIEW_H, CX, CY, R_INNER,
} from '../lib/donutGeometry'

/**
 * Spend by category.
 *
 * Tapping a slice pulls it out of the ring and puts its numbers in the middle;
 * tapping it again puts the trip total back. Identity is never carried by
 * colour alone — every slice is in the legend below with its emoji and name,
 * the big ones are labelled directly, and the breakdown underneath is the full
 * table. That redundancy is also what licenses the three palette slots that
 * sit under 3:1 against white.
 */
export default function CategoryDonut({ report, symbol, selectedKey, onSelect }) {
  const arcs = buildArcs(report.slices)
  if (!arcs.length) return null

  const money = (n) => `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  const selected = arcs.find((a) => a.key === selectedKey) || null

  const centreTop = selected ? selected.label : 'Trip total'
  const centreValue = selected ? selected.total : report.total
  const centreSub = selected ? percentLabel(selected.share) : `${report.categories.length} categories`

  return (
    <div className="donut-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="donut"
        role="img"
        aria-label={`Spending by category. ${arcs
          .map((a) => `${a.label} ${money(a.total)}, ${percentLabel(a.share)}`)
          .join('. ')}`}
      >
        {arcs.map((arc) => {
          const isSelected = arc.key === selectedKey
          return (
            <g
              key={arc.key}
              className={`donut-slice ${isSelected ? 'is-selected' : ''}`}
              style={{ transform: isSelected ? `translate(${arc.dx}px, ${arc.dy}px)` : undefined }}
            >
              <path
                d={arc.path}
                fill={arc.color}
                /* A surface-coloured ring rather than a dark stroke: it reads
                   as a gap between fills instead of an outline around them. */
                stroke="var(--color-surface)"
                strokeWidth="2"
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${arc.label}, ${money(arc.total)}, ${percentLabel(arc.share)}`}
                onClick={() => onSelect(isSelected ? null : arc.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(isSelected ? null : arc.key)
                  }
                }}
              />
            </g>
          )
        })}

        {/* Direct labels ride outside the ring in ordinary text ink — never in
            the slice colour, and never inside a fill they'd fight for contrast
            with. */}
        {arcs.filter((a) => a.showLabel).map((arc) => (
          <text
            key={`label-${arc.key}`}
            x={arc.labelX}
            y={arc.labelY}
            textAnchor={arc.labelAnchor}
            dominantBaseline="middle"
            className="donut-direct-label"
          >
            {percentLabel(arc.share)}
          </text>
        ))}

        <circle cx={CX} cy={CY} r={R_INNER - 2} fill="var(--color-surface)" />
        <text x={CX} y={CY - 14} textAnchor="middle" className="donut-centre-top">
          {centreTop.length > 16 ? `${centreTop.slice(0, 15)}…` : centreTop}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" className="donut-centre-value">
          {money(centreValue)}
        </text>
        <text x={CX} y={CY + 26} textAnchor="middle" className="donut-centre-sub">
          {centreSub}
        </text>
      </svg>

      <div className="donut-legend">
        {arcs.map((arc) => (
          <button
            key={arc.key}
            type="button"
            className={`donut-legend-item ${arc.key === selectedKey ? 'is-selected' : ''}`}
            onClick={() => onSelect(arc.key === selectedKey ? null : arc.key)}
          >
            <span className="donut-swatch" style={{ background: arc.color }} aria-hidden="true" />
            <span className="donut-legend-name">
              {arc.emoji} {arc.label}
              {/* A folded slice says so. Without this the legend shows six
                  rows while the centre counts seven categories, and the
                  missing head looks like a bug rather than a fold. */}
              {arc.folded.length > 0 && (
                <span className="donut-legend-folded"> incl. {arc.folded.join(', ')}</span>
              )}
            </span>
            <span className="donut-legend-value">{money(arc.total)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
