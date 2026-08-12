/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'
import { calculatePersonTotals } from '../lib/personTotals'
import { currencySymbol } from '../lib/currency'
import { personColor } from '../lib/personColors'
import { categoryEmoji } from '../lib/categories'
import { formatDay, dayKey } from '../lib/dates'

const money = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function BalanceSummary() {
  const participants = useTripStore((s) => s.participants)
  const expenses = useTripStore((s) => s.expenses)
  const settlementRecords = useTripStore((s) => s.settlementRecords)
  const trip = useTripStore((s) => s.trip)
  const symbol = currencySymbol(trip?.currency)

  const [expandedId, setExpandedId] = useState(null)

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p>No expenses to calculate balances</p>
      </div>
    )
  }

  // Balances include recorded settlements, so this tab always agrees
  // with the Settle tab.
  const { balances } = calculateSettlements(participants, expenses, settlementRecords)
  const totals = calculatePersonTotals(participants, expenses)

  const totalSpend = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Spend</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{symbol}{totalSpend.toLocaleString()}</div>
      </div>

      {/* Who spent what — paid vs share vs net, per person */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--color-text-muted)' }}>
          Who Spent What
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          <strong>Paid</strong> is money they put in · <strong>Share</strong> is their part of the bills.
          Tap a name to see their spends.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participants.map((p, index) => {
            const color = personColor(index)
            const t = totals[p.id] || { paid: 0, share: 0, expenses: [] }
            const net = Math.round((balances[p.id] || 0) * 100) / 100
            const pct = totalSpend > 0 ? Math.round((t.paid / totalSpend) * 100) : 0
            const open = expandedId === p.id

            let netClass = 'amount-neutral'
            let netLabel = 'settled'
            if (net > 0.01) {
              netClass = 'amount-positive'
              netLabel = `+${symbol}${money(net)}`
            } else if (net < -0.01) {
              netClass = 'amount-negative'
              netLabel = `−${symbol}${money(Math.abs(net))}`
            }

            return (
              <div
                key={p.id}
                style={{
                  background: color.tint,
                  borderLeft: `4px solid ${color.accent}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                <button
                  className="person-row"
                  onClick={() => setExpandedId(open ? null : p.id)}
                  aria-expanded={open}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {p.emoji || ''} {p.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {pct}% of spend {open ? '▾' : '▸'}
                    </span>
                  </div>
                  <div className="person-stats">
                    <span>
                      <span className="person-stat-label">Paid</span>
                      {symbol}{money(t.paid)}
                    </span>
                    <span>
                      <span className="person-stat-label">Share</span>
                      {symbol}{money(t.share)}
                    </span>
                    <span>
                      <span className="person-stat-label">Net</span>
                      <span className={netClass}>{netLabel}</span>
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="person-expenses">
                    {t.expenses.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Hasn’t paid for anything yet.
                      </p>
                    ) : (
                      t.expenses.map((e) => (
                        <div key={e.id} className="person-expense-row">
                          <span style={{ minWidth: 0 }}>
                            <span aria-hidden="true">{categoryEmoji(e.description)}</span>{' '}
                            {e.description}
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                              {' '}· {formatDay(dayKey(e))}
                            </span>
                          </span>
                          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {symbol}{money(e.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
          Net Balances
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {participants.map((p, index) => {
            const balance = balances[p.id] || 0
            const rounded = Math.round(balance * 100) / 100
            let className = 'amount-neutral'
            let label = 'settled'
            if (rounded > 0.01) {
              className = 'amount-positive'
              label = `gets back ${symbol}${rounded.toLocaleString()}`
            } else if (rounded < -0.01) {
              className = 'amount-negative'
              label = `owes ${symbol}${Math.abs(rounded).toLocaleString()}`
            }

            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="person-dot" style={{ background: personColor(index).accent }} />
                  {p.emoji || ''} {p.name}
                </span>
                <span className={className}>{label}</span>
              </div>
            )
          })}
        </div>
        {settlementRecords.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12 }}>
            Includes {settlementRecords.length} recorded settlement{settlementRecords.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
