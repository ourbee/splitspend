/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// The trip diary as an editable Word document.
//
// This is Word-flavoured HTML saved as .doc, not a real .docx — a deliberate
// trade, chosen for being a few dozen lines instead of a hand-written
// WordprocessingML zip. Word may greet it with a "different format than its
// extension" notice on open; it edits normally afterwards, and Google Docs
// and LibreOffice take it without complaint.
//
// Three things that constrain how this file is written:
//
//   * Word's HTML importer ignores <svg>, so the donut cannot come along. The
//     chart here is a 100%-wide table row of coloured cells — a stacked bar,
//     which is the form part-to-whole data wants anyway, and one Word renders
//     reliably because table cell shading is as old as the format.
//   * Layout has to be tables and inline attributes. Modern CSS gets dropped,
//     so anything load-bearing is expressed the way Word 97 would have.
//   * The running credit at the foot of every page is a REAL Word footer —
//     an mso-element div bound to the section by `mso-footer`. This is the one
//     place the every-page requirement is honoured exactly rather than
//     approximated: the printable page can only fake it with a fixed element.
//
// Compact density folds bill rows into one line and tightens the type. It does
// not go two-column the way the printable page does: a multi-column Word
// section would reflow the statement tables too, and a statement that has been
// squeezed into a half-width column is worse than a longer document.

import { calculateSettlements } from './settlement'
import { calculatePersonTotals } from './personTotals'
import { currencySymbol } from './currency'
import { categoryEmoji } from './categories'
import { experienceEmoji } from './experiences'
import { groupByDay, formatDay } from './dates'
import { sortExpenses } from './expenseOrder'
import { round2 } from './splits'
import { buildReport } from './reportData'
import { percentLabel } from './donutGeometry'
import { FOOTER_TEXT } from './attribution'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (symbol, n) =>
  `${symbol}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const COMPACT_BILL_CHARS = 110

function compactBillLine(items) {
  const names = items.map((li) => li?.name).filter(Boolean)
  if (!names.length) return ''
  let line = names.join(' · ')
  if (line.length > COMPACT_BILL_CHARS) {
    line = `${line.slice(0, COMPACT_BILL_CHARS).replace(/[\s·]+\S*$/, '')}…`
  }
  return `<br><span style="font-size:8.5pt;color:#64748b">${names.length} items · ${esc(line)}</span>`
}

export function buildDiaryDoc(
  trip, participants, expenses, events, settlementRecords,
  { order = 'forward', density = 'full' } = {}
) {
  const symbol = currencySymbol(trip.currency)
  const getP = (id) => participants.find((p) => p.id === id)
  const name = (id) => getP(id)?.name || 'Unknown'
  const compact = density === 'compact'
  const bodySize = compact ? '9.5pt' : '11pt'
  const metaSize = compact ? '8pt' : '9pt'

  const items = sortExpenses([...expenses, ...events])
  const forward = order !== 'reverse'
  const allGroups = groupByDay(items)
  const groups = forward ? allGroups.slice().reverse() : allGroups

  const grandTotal = round2(expenses.reduce((s, e) => s + Number(e.amount), 0))
  const totals = calculatePersonTotals(participants, expenses)
  const { balances, settlements } = calculateSettlements(participants, expenses, settlementRecords)
  const report = buildReport(expenses)

  // ---- The written summary, when there is one ----------------------------
  const summaryBlock = trip.summary
    ? trip.summary
        .split(/\n{2,}/)
        .map((para) => `<p align="justify">${esc(para.trim())}</p>`)
        .join('')
    : ''

  // ---- Reports -----------------------------------------------------------
  // One row, one cell per category, widths in percent. Slices under 2% are
  // dropped from the bar rather than becoming an invisible sliver that Word
  // rounds up to a whole column; the table below still lists them in full.
  const barCells = report.slices
    .filter((slice) => slice.share >= 0.02)
    .map((slice) => {
      const width = Math.round(slice.share * 100)
      return `<td width="${width}%" bgcolor="${slice.color}" style="background:${slice.color};height:18px;font-size:1px;line-height:1px">&nbsp;</td>`
    })
    .join('')

  const bar = barCells
    ? `<table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${barCells}</tr></table>`
    : ''

  const reportRows = report.categories.map((category) => {
    const subs = category.subs.map((sub) => `
      <tr>
        <td style="padding-left:22pt;color:#475569">${esc(`${sub.emoji} ${sub.label}`)}</td>
        <td align="right" style="color:#94a3b8">${sub.count}</td>
        <td align="right" style="color:#475569">${money(symbol, sub.total)}</td>
      </tr>`).join('')

    return `
      <tr>
        <td style="border-top:1px solid #cbd5e1">
          <span style="background:${category.color};color:${category.color}">&nbsp;&nbsp;</span>
          <b>${esc(`${category.emoji} ${category.label}`)}</b>
        </td>
        <td align="right" style="border-top:1px solid #cbd5e1;color:#64748b">${percentLabel(category.share)}</td>
        <td align="right" style="border-top:1px solid #cbd5e1"><b>${money(symbol, category.total)}</b></td>
      </tr>
      ${subs}`
  }).join('')

  const reportBlock = report.total > 0 ? `
    <h2>Where the money went</h2>
    ${bar}
    <table width="100%" cellspacing="0" cellpadding="4" border="0">
      <tr>
        <td><b>Category</b></td>
        <td align="right"><b>Share</b></td>
        <td align="right"><b>Spent</b></td>
      </tr>
      ${reportRows}
    </table>
    <p>&nbsp;</p>` : ''

  // ---- The day-by-day story ---------------------------------------------
  const dayBlocks = groups.map((group) => {
    const dayItems = forward ? group.expenses.slice().reverse() : group.expenses
    const rows = dayItems.map((item) => {
      if (item._type === 'event') {
        return `
          <tr>
            <td width="70%" style="padding:3pt 0">
              <i>${esc(item.emoji || experienceEmoji(item.title))} ${esc(item.title)}</i>
              ${item.note ? `<br><span style="font-size:${metaSize};color:#475569">${esc(item.note)}</span>` : ''}
            </td>
            <td align="right" style="padding:3pt 0">&nbsp;</td>
          </tr>`
      }

      const icon = item.emoji || categoryEmoji(item.description)
      const shares = (item.splits || [])
        .map((s) => `${esc(name(s.participant_id))} ${money(symbol, s.share_amount)}`)
        .join(' · ')

      // Bill rows travel into the document as a nested table so they stay
      // editable — the whole point of handing over a Word file. Compact folds
      // them to a single line instead.
      const billRows = (item.line_items || []).map((li) => `
        <tr>
          <td style="font-size:${metaSize};color:#475569">${esc(li.name)}</td>
          <td align="right" style="font-size:${metaSize};color:#475569">${esc(li.qty ?? '')}</td>
          <td align="right" style="font-size:${metaSize};color:#475569">${li.unit_price != null ? money(symbol, li.unit_price) : ''}</td>
          <td align="right" style="font-size:${metaSize};color:#475569">${li.amount != null ? money(symbol, li.amount) : ''}</td>
        </tr>`).join('')

      let bill = ''
      if (compact) {
        bill = compactBillLine(item.line_items || [])
      } else if (billRows) {
        bill = `
        <table width="100%" cellspacing="0" cellpadding="2" border="0" style="margin-top:3pt">
          <tr>
            <td style="font-size:8pt;color:#94a3b8">ITEM</td>
            <td align="right" style="font-size:8pt;color:#94a3b8">QTY</td>
            <td align="right" style="font-size:8pt;color:#94a3b8">RATE</td>
            <td align="right" style="font-size:8pt;color:#94a3b8">AMOUNT</td>
          </tr>
          ${billRows}
        </table>`
      }

      return `
        <tr>
          <td width="70%" style="padding:3pt 0">
            <b>${esc(icon)} ${esc(item.description)}</b><br>
            <span style="font-size:${metaSize};color:#64748b">Paid by ${esc(name(item.paid_by))} · Split: ${shares}</span>
            ${item.note ? `<br><span style="font-size:${metaSize};color:#475569">${esc(item.note)}</span>` : ''}
            ${bill}
          </td>
          <td align="right" valign="top" style="padding:3pt 0"><b>${money(symbol, item.amount)}</b></td>
        </tr>`
    }).join('')

    return `
      <h3 style="border-bottom:1px solid #cbd5e1">
        ${esc(formatDay(group.key))}
        ${group.total > 0 ? `<span style="font-weight:normal;color:#64748b">&nbsp;&nbsp;${money(symbol, group.total)}</span>` : ''}
      </h3>
      <table width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`
  }).join('')

  // ---- Statement ---------------------------------------------------------
  const totalsRows = participants.map((p) => {
    const t = totals[p.id] || { paid: 0, share: 0 }
    return `<tr>
      <td>${esc(`${p.emoji || ''} ${p.name}`.trim())}</td>
      <td align="right">${money(symbol, t.paid)}</td>
      <td align="right">${money(symbol, t.share)}</td>
    </tr>`
  }).join('')

  const balanceRows = participants.map((p) => {
    const bal = round2(balances[p.id] || 0)
    let label
    if (bal > 0.01) label = `gets back ${money(symbol, bal)}`
    else if (bal < -0.01) label = `owes ${money(symbol, Math.abs(bal))}`
    else label = 'settled up'
    return `<tr><td>${esc(p.name)}</td><td align="right">${label}</td></tr>`
  }).join('')

  const settlementRows = settlements.length
    ? settlements.map((s) =>
        `<tr><td>${esc(name(s.from))} → ${esc(name(s.to))}</td><td align="right">${money(symbol, s.amount)}</td></tr>`
      ).join('')
    : '<tr><td colspan="2">All settled — nothing left to pay.</td></tr>'

  const historyBlock = settlementRecords.length ? `
    <h3>Payments recorded</h3>
    <table width="100%" cellspacing="0" cellpadding="4" border="0">
      ${settlementRecords.slice().reverse().map((r) =>
        `<tr>
          <td>${esc(name(r.from_participant))} paid ${esc(name(r.to_participant))}
            <span style="color:#94a3b8">· ${new Date(r.settled_at).toLocaleDateString()}</span></td>
          <td align="right">${money(symbol, r.amount)}</td>
        </tr>`
      ).join('')}
    </table>` : ''

  const first = groups.length ? groups[0].key : null
  const last = groups.length ? groups[groups.length - 1].key : null
  const dateRange = groups.length
    ? (groups.length === 1
        ? formatDay(first)
        : (forward ? `${formatDay(first)} — ${formatDay(last)}` : `${formatDay(last)} — ${formatDay(first)}`))
    : ''

  // The xmlns declarations and the ProgId meta are what make Word treat this
  // as its own document rather than a web page pasted into one. Section1 plus
  // `mso-footer:f1` is what binds the credit line to every page.
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<title>${esc(trip.name)} — Splitspend Diary</title>
<!--[if gte mso 9]><xml>
  <w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument>
</xml><![endif]-->
<style>
  @page Section1 {
    size: 595.3pt 841.9pt;
    margin: ${compact ? '38pt' : '45.35pt'};
    mso-header-margin: 35.4pt;
    mso-footer-margin: 24pt;
    mso-paper-source: 0;
    mso-footer: f1;
  }
  div.Section1 { page: Section1; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: ${bodySize}; color: #1e293b; }
  h1 { font-size: ${compact ? '17pt' : '20pt'}; text-align: center; margin-bottom: 2pt; }
  h2 { font-size: ${compact ? '12.5pt' : '14pt'}; margin-top: ${compact ? '12pt' : '16pt'}; }
  h3 { font-size: ${compact ? '10pt' : '11pt'}; margin-top: ${compact ? '9pt' : '12pt'}; }
  td { vertical-align: top; }
  p.MsoFooter {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 8pt;
    color: #94a3b8;
    text-align: center;
  }
</style>
</head>
<body>
<div class="Section1">
  <h1>${esc(trip.name)}</h1>
  ${dateRange ? `<p align="center" style="color:#64748b">${esc(dateRange)}</p>` : ''}
  <p align="center">${participants.map((p) => esc(`${p.emoji || ''} ${p.name}`.trim())).join(' · ')}</p>

  ${summaryBlock}

  ${reportBlock}

  ${dayBlocks || '<p align="center" style="color:#64748b">Nothing here yet.</p>'}

  <h2>Statement</h2>
  <p align="right"><b>Trip total: ${money(symbol, grandTotal)}</b></p>

  <h3>Who paid, who consumed</h3>
  <table width="100%" cellspacing="0" cellpadding="4" border="0">
    <tr><td><b>Person</b></td><td align="right"><b>Paid</b></td><td align="right"><b>Their share</b></td></tr>
    ${totalsRows}
  </table>

  <h3>Net balances</h3>
  <table width="100%" cellspacing="0" cellpadding="4" border="0">${balanceRows}</table>

  <h3>Settlements still needed</h3>
  <table width="100%" cellspacing="0" cellpadding="4" border="0">${settlementRows}</table>

  ${historyBlock}

  <div style="mso-element:footer" id="f1">
    <p class="MsoFooter">${esc(FOOTER_TEXT)}</p>
  </div>
</div>
</body>
</html>`
}

/** Download the diary as an editable Word file. */
export function downloadDiaryDoc(trip, participants, expenses, events, settlementRecords, options) {
  const html = buildDiaryDoc(trip, participants, expenses, events, settlementRecords, options)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_diary.doc`
  a.click()
  URL.revokeObjectURL(url)
}
