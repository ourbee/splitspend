/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// A scanned ticket's particulars, turned into the two or three lines a person
// would actually write in a notebook.
//
// These go into the expense or event note, which is why there is no migration
// behind this: the note is free text, and it is already what the card, the
// diary, the Word export and the written summary all read from. A ticket
// photographed as an expense and the same ticket photographed as a diary event
// come out identically, because both scanners return the same block and both
// pass it through here.

const line = (parts) => parts.filter(Boolean).join(' · ')

/**
 * Format the travel block from either scanner.
 * Returns a short multi-line string, or null when there is nothing to say.
 */
export function formatTravel(travel) {
  if (!travel || typeof travel !== 'object') return null

  const lines = []

  // Who and where: "IndiGo 6E 763 · Kolkata → Hyderabad"
  const service = [travel.operator, travel.service].filter(Boolean).join(' ')
  const route = [travel.from, travel.to].filter(Boolean).join(' → ')
  const head = line([service, route])
  if (head) lines.push(head)

  // The seat, in the order a ticket prints it.
  const seat = line([
    travel.coach && `Coach ${travel.coach}`,
    travel.seat && `Seat ${travel.seat}`,
    travel.seat_class,
  ])
  if (seat) lines.push(seat)

  // When and where from. Boarding and departure are usually the same minute on
  // a train ticket and twenty apart on a boarding pass, so both are kept only
  // when they actually differ.
  const boards = travel.boarding_time
  const departs = travel.departure_time === boards ? null : travel.departure_time
  const when = line([
    boards && `Boards ${boards}`,
    departs && `Departs ${departs}`,
    travel.gate && `Gate ${travel.gate}`,
    travel.platform && `Platform ${travel.platform}`,
  ])
  if (when) lines.push(when)

  if (travel.pnr) lines.push(`PNR ${travel.pnr}`)

  return lines.length ? lines.join('\n') : null
}

/**
 * Append a scan's text to whatever the person has already typed, without
 * repeating a line that is already there — a second scan of the same ticket
 * should not double the seat number.
 */
export function appendToNote(existing, ...blocks) {
  const out = []
  const seen = new Set()
  for (const block of [existing, ...blocks]) {
    if (typeof block !== 'string') continue
    for (const raw of block.split('\n')) {
      const text = raw.trim()
      if (!text) continue
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(text)
    }
  }
  return out.join('\n')
}
