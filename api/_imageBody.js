/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Shared by both scanners. Underscore-prefixed, so it is a module rather than
// a route.
//
// A photo used to arrive as base64 inside JSON, which costs a third more bytes
// on the wire than the photo itself and makes the phone build a multi-megabyte
// string on the main thread before a single byte is sent. It now arrives as
// raw bytes with the format in the Content-Type header — and the JSON shape is
// still accepted, because a bundle cached on somebody's phone will keep
// sending it for a while yet.

// What Gemini takes as inline data. The list is also the allowlist: a
// Content-Type outside it is refused rather than relayed onward.
export const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// The platform caps a serverless request body at 4.5MB. A downscaled photo is
// a fraction of this; an undecodable HEIC forwarded whole is what needs room.
export const MAX_BYTES = 3_500_000
const MAX_BASE64 = Math.ceil(MAX_BYTES * 4 / 3)

function collect(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      // Stop reading rather than buffer a body that is already too big.
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error('Image too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * Pull the photo out of a request in whichever shape it arrived.
 * Resolves to { data, mimeType } with data as base64, or { error, status }.
 */
export async function readImage(req) {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()

  // The old shape: { image: <base64>, mimeType }.
  if (contentType === 'application/json') {
    const image = req.body?.image
    if (typeof image !== 'string' || image.length < 100) {
      return { error: 'No image received', status: 400 }
    }
    if (image.length > MAX_BASE64) {
      return { error: 'Image too large', status: 413 }
    }
    const declared = req.body?.mimeType
    return { data: image, mimeType: MIME_TYPES.includes(declared) ? declared : 'image/jpeg' }
  }

  if (!MIME_TYPES.includes(contentType)) {
    return { error: 'Send the photo as image bytes with an image Content-Type', status: 415 }
  }

  // Raw bytes. The runtime hands over a Buffer for a body it does not parse,
  // but that is not guaranteed for every content type, so the stream is read
  // directly when it does not.
  let buffer = req.body
  if (!Buffer.isBuffer(buffer)) {
    if (typeof buffer === 'string') {
      // Already consumed and decoded as text: the bytes are unrecoverable.
      return { error: 'Image body could not be read', status: 400 }
    }
    try {
      buffer = await collect(req)
    } catch (err) {
      return { error: err.message || 'Image body could not be read', status: err.status || 400 }
    }
  }

  if (!buffer?.length) return { error: 'No image received', status: 400 }
  if (buffer.length > MAX_BYTES) return { error: 'Image too large', status: 413 }

  return { data: buffer.toString('base64'), mimeType: contentType }
}
