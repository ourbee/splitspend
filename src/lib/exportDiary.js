/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// "Trip Diary" export: a printable page — day-by-day story of expenses and
// diary events, followed by an invoice-style statement (per-person totals,
// net balances, settlements). Rendered into an in-app iframe rather than a
// new tab: phone browsers block window.open often enough that a pop-up would
// make the feature look broken. Fully client-side; nothing leaves the device.

import { calculateSettlements } from './settlement'
import { calculatePersonTotals } from './personTotals'
import { currencySymbol } from './currency'
import { categoryEmoji } from './categories'
import { groupByDay, formatDay } from './dates'
import { sortExpenses } from './expenseOrder'
import { round2 } from './splits'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (symbol, n) =>
  `${symbol}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function buildDiaryHtml(trip, participants, expenses, events, settlementRecords) {
  const symbol = currencySymbol(trip.currency)
  const getP = (id) => participants.find((p) => p.id === id)
  const name = (id) => getP(id)?.name || 'Unknown'

  const items = sortExpenses([...expenses, ...events])
  // The list is newest-first for the app; a diary reads oldest-first.
  const groups = groupByDay(items).slice().reverse()

  const grandTotal = round2(expenses.reduce((s, e) => s + Number(e.amount), 0))
  const totals = calculatePersonTotals(participants, expenses)
  const { balances, settlements } = calculateSettlements(participants, expenses, settlementRecords)

  const dayBlocks = groups.map((group) => {
    const dayItems = group.expenses.slice().reverse().map((item) => {
      if (item._type === 'event') {
        return `
        <div class="entry event">
          <span class="entry-emoji">${esc(item.emoji || '📍')}</span>
          <div class="entry-body">
            <div class="entry-title">${esc(item.title)}</div>
            ${item.note ? `<div class="entry-note">${esc(item.note)}</div>` : ''}
          </div>
        </div>`
      }
      const icon = item.emoji || categoryEmoji(item.description)
      const shares = (item.splits || [])
        .map((s) => `${esc(name(s.participant_id))} ${money(symbol, s.share_amount)}`)
        .join(' · ')
      return `
        <div class="entry">
          <span class="entry-emoji">${esc(icon)}</span>
          <div class="entry-body">
            <div class="entry-title">${esc(item.description)}
              <span class="entry-amount">${money(symbol, item.amount)}</span>
            </div>
            <div class="entry-meta">Paid by ${esc(name(item.paid_by))} · Split: ${shares}</div>
            ${item.note ? `<div class="entry-note">${esc(item.note)}</div>` : ''}
          </div>
        </div>`
    }).join('')

    return `
      <section class="day">
        <h2>${esc(formatDay(group.key))}
          ${group.total > 0 ? `<span class="day-total">${money(symbol, group.total)}</span>` : ''}
        </h2>
        ${dayItems}
      </section>`
  }).join('')

  const totalsRows = participants.map((p) => {
    const t = totals[p.id] || { paid: 0, share: 0 }
    return `<tr>
      <td>${esc(`${p.emoji || ''} ${p.name}`.trim())}</td>
      <td class="num">${money(symbol, t.paid)}</td>
      <td class="num">${money(symbol, t.share)}</td>
    </tr>`
  }).join('')

  const balanceRows = participants.map((p) => {
    const bal = round2(balances[p.id] || 0)
    let label
    if (bal > 0.01) label = `gets back ${money(symbol, bal)}`
    else if (bal < -0.01) label = `owes ${money(symbol, Math.abs(bal))}`
    else label = 'settled up'
    return `<tr><td>${esc(p.name)}</td><td class="num">${label}</td></tr>`
  }).join('')

  const settlementRows = settlements.length
    ? settlements.map((s) =>
        `<tr><td>${esc(name(s.from))} → ${esc(name(s.to))}</td><td class="num">${money(symbol, s.amount)}</td></tr>`
      ).join('')
    : '<tr><td colspan="2">All settled — nothing left to pay.</td></tr>'

  const historyBlock = settlementRecords.length ? `
    <h3>Payments recorded</h3>
    <table>
      ${settlementRecords.slice().reverse().map((r) =>
        `<tr><td>${esc(name(r.from_participant))} paid ${esc(name(r.to_participant))}
         <span class="muted">· ${new Date(r.settled_at).toLocaleDateString()}</span></td>
         <td class="num">${money(symbol, r.amount)}</td></tr>`
      ).join('')}
    </table>` : ''

  const dateRange = groups.length
    ? (groups.length === 1
        ? formatDay(groups[0].key)
        : `${formatDay(groups[0].key)} — ${formatDay(groups[groups.length - 1].key)}`)
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(trip.name)} — Splitspend Diary</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1e293b;
    background: #fff;
    max-width: 680px;
    margin: 0 auto;
    padding: 40px 24px 60px;
    line-height: 1.55;
  }
  header { text-align: center; margin-bottom: 36px; }
  header h1 { font-size: 30px; margin-bottom: 4px; }
  header .sub { color: #64748b; font-size: 14px; }
  header .people { margin-top: 10px; font-size: 14px; }
  .day { margin-bottom: 26px; break-inside: avoid-page; }
  .day h2 {
    font-size: 15px;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .day-total { font-size: 13px; color: #64748b; font-weight: normal; }
  .entry { display: flex; gap: 10px; margin-bottom: 12px; }
  .entry.event {
    border-left: 3px double #94a3b8;
    padding: 4px 0 4px 12px;
    font-style: italic;
  }
  .entry-emoji { flex-shrink: 0; font-size: 17px; line-height: 1.4; }
  .entry-title { font-weight: 600; font-size: 15px; }
  .entry-amount { float: right; font-weight: 700; }
  .entry-body { flex: 1; min-width: 0; }
  .entry-meta { font-size: 12.5px; color: #64748b; }
  .entry-note { font-size: 13px; color: #475569; margin-top: 2px; white-space: pre-wrap; }
  .statement { margin-top: 44px; border-top: 3px double #94a3b8; padding-top: 22px; break-inside: avoid-page; }
  .statement h2 { font-size: 18px; margin-bottom: 14px; }
  .statement h3 { font-size: 14px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 5px 8px 5px 0; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #94a3b8; font-size: 12px; }
  .grand { margin: 14px 0 4px; font-size: 15px; font-weight: 700; text-align: right; }
  footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; }
  @page { margin: 16mm; }
</style>
</head>
<body>
  <header>
    <h1>${esc(trip.name)}</h1>
    ${dateRange ? `<div class="sub">${esc(dateRange)}</div>` : ''}
    <div class="people">${participants.map((p) => esc(`${p.emoji || ''} ${p.name}`.trim())).join(' · ')}</div>
  </header>

  ${dayBlocks || '<p style="text-align:center;color:#64748b">Nothing here yet.</p>'}

  <div class="statement">
    <h2>Statement</h2>
    <div class="grand">Trip total: ${money(symbol, grandTotal)}</div>
    <h3>Who paid, who consumed</h3>
    <table>
      <tr><th>Person</th><th class="num">Paid</th><th class="num">Their share</th></tr>
      ${totalsRows}
    </table>
    <h3>Net balances</h3>
    <table>${balanceRows}</table>
    <h3>Settlements still needed</h3>
    <table>${settlementRows}</table>
    ${historyBlock}
  </div>

  <footer>
    Exported from Splitspend · ${new Date().toLocaleDateString()} · splitspend.vercel.app
  </footer>
</body>
</html>`
}

/** Download the diary as a standalone .html file, openable and printable later. */
export function downloadDiary(trip, participants, expenses, events, settlementRecords) {
  const html = buildDiaryHtml(trip, participants, expenses, events, settlementRecords)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_diary.html`
  a.click()
  URL.revokeObjectURL(url)
}
