/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Shared by both scanners: a photo goes to a model at a size a model can read,
// which is nowhere near the size a phone camera produces. Downscaling here
// rather than server-side is also what keeps the upload — and the time the
// person spends watching a spinner — small.

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.8

/** Downscale + re-encode to keep the upload small; returns base64 (no prefix). */
export async function toBase64Jpeg(file) {
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
