/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Shared by both scanners. Underscore-prefixed, so it is a module rather than
// a route.
//
// Tickets are the one purchase where the particulars matter as much as the
// price: which seat, which coach, which platform, what the PNR was. Both
// scanners ask for the same block so a bus ticket photographed as an expense
// and the same ticket photographed as a diary event read identically.

// Every field is a short printed string or nothing. Values arrive with their
// label still attached often enough ("Coach B4", "Gate: 12") that the label is
// stripped here rather than trusted to the prompt, so a note never ends up
// reading "Coach Coach B4".
export const TRAVEL_FIELDS = {
  operator: 60, service: 60, from: 60, to: 60, pnr: 24, seat: 24,
  coach: 16, seat_class: 32, boarding_time: 16, departure_time: 16,
  gate: 12, platform: 12,
}

const LABELS = {
  pnr: /^(pnr|booking(\s*ref(erence)?)?|ref(erence)?|ticket(\s*no\.?)?)\b[:\s-]*/i,
  seat: /^(seat|berth)\b[:\s-]*/i,
  coach: /^(coach|bogie|car)\b[:\s-]*/i,
  seat_class: /^(class)\b[:\s-]*/i,
  gate: /^(gate)\b[:\s-]*/i,
  platform: /^(platform|plat|pf)\b[:\s-]*/i,
  boarding_time: /^(boarding|boards?)(\s*time)?\b[:\s-]*/i,
  departure_time: /^(departure|departs?|dep)(\s*time)?\b[:\s-]*/i,
}

export function cleanTravel(travel) {
  if (!travel || typeof travel !== 'object') return null
  const out = {}
  let any = false
  for (const [field, limit] of Object.entries(TRAVEL_FIELDS)) {
    let value = travel[field]
    if (typeof value === 'number') value = String(value)
    if (typeof value !== 'string') { out[field] = null; continue }
    value = value.trim()
    if (LABELS[field]) value = value.replace(LABELS[field], '').trim()
    // "N/A", "-", "null" and friends come back often enough to be worth naming.
    if (!value || /^(n\/?a|none|null|nil|-{1,}|not applicable)$/i.test(value)) {
      out[field] = null
      continue
    }
    out[field] = value.slice(0, limit)
    any = true
  }
  return any ? out : null
}

