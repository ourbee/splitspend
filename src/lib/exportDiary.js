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
import { buildReport } from './reportData'
import { renderDonutSvg } from './donutSvg'
import { percentLabel } from './donutGeometry'

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

      // What was actually on the bill, printed under the expense it belongs
      // to. Read-only here — a diary is a record of what happened.
      const billRows = (item.line_items || []).map((li) => `
        <tr>
          <td>${esc(li.name)}</td>
          <td class="num">${esc(li.qty ?? '')}</td>
          <td class="num">${li.unit_price != null ? money(symbol, li.unit_price) : ''}</td>
          <td class="num">${li.amount != null ? money(symbol, li.amount) : ''}</td>
        </tr>`).join('')

      const bill = billRows ? `
        <table class="bill">
          <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
          ${billRows}
        </table>` : ''

      return `
        <div class="entry">
          <span class="entry-emoji">${esc(icon)}</span>
          <div class="entry-body">
            <div class="entry-title">${esc(item.description)}
              <span class="entry-amount">${money(symbol, item.amount)}</span>
            </div>
            <div class="entry-meta">Paid by ${esc(name(item.paid_by))} · Split: ${shares}</div>
            ${item.note ? `<div class="entry-note">${esc(item.note)}</div>` : ''}
            ${bill}
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

  // The report leads the diary: the shape of the trip's spending first, the
  // day-by-day story after it, the statement last.
  const report = buildReport(expenses)
  const donut = renderDonutSvg(report, symbol)

  const reportRows = report.categories.map((category) => {
    const subs = category.subs.map((sub) => `
      <tr class="sub">
        <td>${esc(`${sub.emoji} ${sub.label}`)}</td>
        <td class="num muted">${sub.count}</td>
        <td class="num">${money(symbol, sub.total)}</td>
      </tr>`).join('')

    return `
      <tr class="head">
        <td><span class="swatch" style="background:${category.color}"></span>${esc(`${category.emoji} ${category.label}`)}</td>
        <td class="num muted">${percentLabel(category.share)}</td>
        <td class="num">${money(symbol, category.total)}</td>
      </tr>
      ${subs}`
  }).join('')

  const reportBlock = report.total > 0 ? `
  <section class="report">
    <h2>Where the money went</h2>
    <div class="chart">${donut}</div>
    <table class="report-table">
      <tr><th>Category</th><th class="num">Share</th><th class="num">Spent</th></tr>
      ${reportRows}
    </table>
  </section>` : ''

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
  .bill { margin-top: 6px; width: auto; min-width: 60%; }
  .bill th, .bill td { font-size: 12px; color: #475569; padding: 2px 10px 2px 0; border-bottom: none; }
  .bill th { font-size: 10px; color: #94a3b8; }
  .bill tr:first-child th { border-bottom: 1px solid #e2e8f0; }
  .report { margin-bottom: 40px; break-inside: avoid-page; }
  .report h2 { font-size: 18px; margin-bottom: 14px; }
  .chart { text-align: center; margin-bottom: 10px; }
  .chart svg { max-width: 100%; height: auto; }
  .report-table tr.head td { font-weight: 700; border-top: 1px solid #cbd5e1; }
  .report-table tr.sub td { font-size: 13px; color: #475569; border-bottom: none; padding-top: 2px; padding-bottom: 2px; }
  .report-table tr.sub td:first-child { padding-left: 18px; }
  .swatch {
    display: inline-block;
    width: 9px; height: 9px;
    border-radius: 2px;
    margin-right: 7px;
  }
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
  /* Zero page margin, with the inset moved onto the body below, so that the
     browser has nowhere to draw its own print header and footer — which is
     where the trip's URL was being stamped onto every printed sheet. There is
     no CSS that switches those off directly; denying them the margin box is
     the only lever a page has. */
  @page { margin: 0; }
  @media print {
    body { max-width: none; padding: 16mm; }
  }
</style>
</head>
<body>
  <header>
    <h1>${esc(trip.name)}</h1>
    ${dateRange ? `<div class="sub">${esc(dateRange)}</div>` : ''}
    <div class="people">${participants.map((p) => esc(`${p.emoji || ''} ${p.name}`.trim())).join(' · ')}</div>
  </header>

  ${reportBlock}

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
    Exported from Splitspend · ${new Date().toLocaleDateString()}
  </footer>
</body>
</html>`
}

// The raw-HTML download that used to live here was retired in v7: the Word
// export in exportWord.js covers the same need in a file people can edit.
// buildDiaryHtml above is still what the on-screen preview and Print/PDF use.
