/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import { lineItemsTotal, lineItemsMismatch } from '../lib/lineItems'

/**
 * The rows read off a photographed bill.
 *
 * Editable inside the Add/Edit sheet, read-only (and collapsed) on a card. It
 * is deliberately a plain record: nothing here can change the expense amount
 * or anybody's share. When the rows and the total disagree the component says
 * so and stops — reconciling them is a person's judgement, because the gap is
 * usually a real service charge rather than a mistake.
 */
export default function LineItemsTable({
  items,
  symbol,
  amount,
  editable = false,
  onChange,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (!items || items.length === 0) return null

  const total = lineItemsTotal(items)
  const mismatch = lineItemsMismatch(items, amount)
  const money = (n) => `${symbol}${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  const removeRow = (index) => onChange?.(items.filter((_, i) => i !== index))

  const editRow = (index, field, value) => {
    const next = items.map((item, i) => {
      if (i !== index) return item
      if (field === 'name' || field === 'qty') return { ...item, [field]: value || null }
      const n = Number(value)
      return { ...item, [field]: Number.isFinite(n) && n > 0 ? n : null }
    })
    onChange?.(next)
  }

  return (
    <div className="line-items">
      <button
        type="button"
        className="line-items-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        🧾 Bill items ({items.length}) {open ? '▾' : '▸'}
        {!open && <span className="line-items-sum">{money(total)}</span>}
      </button>

      {open && (
        <>
          <div className="line-items-scroll">
            <table className="line-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  {editable && <th aria-label="Remove" />}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    {editable ? (
                      <>
                        <td>
                          <input
                            className="line-input"
                            value={item.name}
                            onChange={(e) => editRow(i, 'name', e.target.value)}
                            aria-label={`Item ${i + 1} name`}
                          />
                        </td>
                        <td className="num">
                          <input
                            className="line-input line-input-sm"
                            value={item.qty ?? ''}
                            onChange={(e) => editRow(i, 'qty', e.target.value)}
                            aria-label={`Item ${i + 1} quantity`}
                          />
                        </td>
                        <td className="num">
                          <input
                            className="line-input line-input-sm"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.unit_price ?? ''}
                            onChange={(e) => editRow(i, 'unit_price', e.target.value)}
                            aria-label={`Item ${i + 1} unit price`}
                          />
                        </td>
                        <td className="num">
                          <input
                            className="line-input line-input-sm"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.amount ?? ''}
                            onChange={(e) => editRow(i, 'amount', e.target.value)}
                            aria-label={`Item ${i + 1} amount`}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => removeRow(i)}
                            title="Remove this row"
                            aria-label={`Remove ${item.name}`}
                            style={{ padding: '2px 6px', color: 'var(--color-text-muted)' }}
                          >
                            &times;
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{item.name}</td>
                        <td className="num">{item.qty ?? ''}</td>
                        <td className="num">{item.unit_price != null ? money(item.unit_price) : ''}</td>
                        <td className="num">{item.amount != null ? money(item.amount) : ''}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="line-items-foot">
            <span>Items total</span>
            <strong>{money(total)}</strong>
          </div>

          {mismatch && (
            <p className="line-items-hint">
              The rows come to {money(mismatch.itemsTotal)} but the expense is {money(mismatch.amount)} —
              a difference of {money(Math.abs(mismatch.difference))}.
              {' '}Often that is tax or a service charge. The expense amount is what gets split either way.
            </p>
          )}
        </>
      )}
    </div>
  )
}
