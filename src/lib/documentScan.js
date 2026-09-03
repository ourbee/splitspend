/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Reading a photographed document into a diary event: boarding passes,
// tickets, hotel confirmations, permits, the board outside a monument.
//
// Same contract as the bill scanner — the photo is downscaled in the browser,
// sent once to /api/scan-document, and discarded. Only the extracted text ever
// reaches the database. The result is a draft the person edits, never
// authority: an event has no amount and no split, so the worst a bad scan can
// do is put a wrong sentence in a diary.

import { toModelImage } from './imageDownscale'

/**
 * OCR a photographed travel document.
 * Resolves to { kind, title, date, details, travel } — every field may be
 * null. `travel` is the same ticket block the bill scanner returns.
 */
export async function scanDocument(file) {
  // { blob, mimeType }: a downscaled WebP or JPEG normally, or the untouched
  // photo when the browser could not decode it but the model can (HEIC). The
  // bytes go up as they are — base64 in JSON cost a third more on the wire and
  // made the phone build a multi-megabyte string before sending anything.
  const image = await toModelImage(file)

  const res = await fetch('/api/scan-document', {
    method: 'POST',
    headers: { 'Content-Type': image.mimeType },
    body: image.blob,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `Scan failed (${res.status})`)
  }

  return {
    kind: body.kind || null,
    title: body.title || null,
    date: body.date || null,
    details: body.details || null,
    travel: body.travel || null,
  }
}
