/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { normaliseLineItems } from './lineItems'
import { toModelImage } from './imageDownscale'

// Bill scanning: the photo is downscaled in the browser, sent once to
// /api/scan-receipt (which relays it to a vision model), and discarded.
// Only the extracted text ever reaches the database — no image storage.
// The downscale step is shared with the document scanner in documentScan.js.

/**
 * OCR a photographed bill.
 * Resolves to { merchant, amount, date, summary, text, items } — every field
 * may be null or empty; the caller treats the result as an editable draft,
 * never as authority. `items` is the per-row breakdown; it is stored as a
 * record beside the expense and never feeds the split maths.
 */
export async function scanReceipt(file) {
  // { data, mimeType }: a downscaled JPEG normally, or the untouched photo
  // when the browser could not decode it but the model can (HEIC).
  const image = await toModelImage(file)

  const res = await fetch('/api/scan-receipt', {
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
    merchant: body.merchant || null,
    amount: Number(body.amount) > 0 ? Number(body.amount) : null,
    date: body.date || null,
    summary: body.summary || null,
    text: body.text || null,
    items: normaliseLineItems(body.items) || [],
  }
}
