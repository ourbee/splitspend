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
 * Resolves to { kind, title, date, details } — every field may be null.
 */
export async function scanDocument(file) {
  // { data, mimeType }: a downscaled JPEG normally, or the untouched photo
  // when the browser could not decode it but the model can (HEIC).
  const image = await toModelImage(file)

  const res = await fetch('/api/scan-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: image.data, mimeType: image.mimeType }),
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
  }
}
