/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import useTripStore from '../store/tripStore'
import { calculateSettlements } from '../lib/settlement'
import { calculatePersonTotals } from '../lib/personTotals'
import { currencySymbol } from '../lib/currency'
import { paletteEntry, resolveColorSlots } from '../lib/personColors'
import { categoryEmoji } from '../lib/categories'
import { formatDay, dayKey } from '../lib/dates'
import SettlementList from './SettlementList'

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
        <p>{participants.length < 2 ? 'No expenses recorded yet' : 'No expenses to calculate balances'}</p>
      </div>
    )
  }

  // A solo Splitspend has no balance to strike: whoever paid also owes it,
  // every net is zero and every settlement list is empty. Rather than print a
  // page of zeroes, the tab becomes what the numbers actually are for one
  // person — the total, and the shape of it.
  if (participants.length < 2) {
    return <SoloTotals expenses={expenses} symbol={symbol} />
  }

  // Balances include recorded settlements, so this tab always agrees
  // with the Settle tab.
  const { balances } = calculateSettlements(participants, expenses, settlementRecords)
  const totals = calculatePersonTotals(participants, expenses)
  const colorSlots = resolveColorSlots(participants)

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
          {participants.map((p) => {
            const color = paletteEntry(colorSlots[p.id])
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

      {/* What used to be a separate Settle tab. The "Net Balances" card that
          stood here was a straight duplicate — "Who Spent What" above already
          shows each person's net — so the settling itself took its place, and
          the tab now reads as one story: the total, then each person, then who
          pays whom. */}
      <SettlementList />
    </div>
  )
}

/**
 * The Balances tab for a one-person Splitspend. No payer, no share, no net —
 * just what was spent, over how many days, and the day that cost the most.
 */
function SoloTotals({ expenses, symbol }) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const byDay = new Map()
  for (const e of expenses) {
    const key = dayKey(e)
    byDay.set(key, (byDay.get(key) || 0) + Number(e.amount))
  }
  const days = byDay.size
  const perDay = days ? total / days : 0

  let dearestDay = null
  for (const [key, amount] of byDay) {
    if (!dearestDay || amount > dearestDay.amount) dearestDay = { key, amount }
  }

  const biggest = expenses.reduce(
    (max, e) => (!max || Number(e.amount) > Number(max.amount) ? e : max),
    null
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Spend</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{symbol}{total.toLocaleString()}</div>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
          The Shape Of It
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="person-expense-row">
            <span>Days with spending</span>
            <span style={{ fontWeight: 600 }}>{days}</span>
          </div>
          <div className="person-expense-row">
            <span>Average a day</span>
            <span style={{ fontWeight: 600 }}>{symbol}{money(perDay)}</span>
          </div>
          {dearestDay && (
            <div className="person-expense-row">
              <span>Dearest day · {formatDay(dearestDay.key)}</span>
              <span style={{ fontWeight: 600 }}>{symbol}{money(dearestDay.amount)}</span>
            </div>
          )}
          {biggest && (
            <div className="person-expense-row">
              <span style={{ minWidth: 0 }}>
                <span aria-hidden="true">{categoryEmoji(biggest.description)}</span>{' '}
                Biggest single spend · {biggest.description}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {symbol}{money(biggest.amount)}
              </span>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: '0 12px' }}>
        Nothing to settle — this Splitspend is just you. Add someone from the
        &#8942; menu and balances will appear here.
      </p>
    </div>
  )
}
