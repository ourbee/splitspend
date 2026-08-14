/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Bill scanning: the photo is downscaled in the browser, sent once to
// /api/scan-receipt (which relays it to a vision model), and discarded.
// Only the extracted text ever reaches the database — no image storage.

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.8

/** Downscale + re-encode to keep the upload small; returns base64 (no prefix). */
async function toBase64Jpeg(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That file could not be read as an image'))
      el.src = url
    })

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * OCR a photographed bill.
 * Resolves to { merchant, amount, date, summary, text } — every field may be
 * null; the caller treats the result as an editable draft, never as authority.
 */
export async function scanReceipt(file) {
  const image = await toBase64Jpeg(file)

  const res = await fetch('/api/scan-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
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
  }
}
