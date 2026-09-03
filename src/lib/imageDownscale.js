/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Shared by both scanners: a photo goes to a model at a size a model can read,
// which is nowhere near the size a phone camera produces. Downscaling here
// rather than server-side is also what keeps the upload — and the time the
// person spends watching a spinner — small.
//
// Getting the photo decoded at all is the hard part, and v9 is where that was
// learned. A single `new Image()` fails on two ordinary phone photos: a HEIC
// or HEIF one (which Chrome on Android cannot decode at all, and which recent
// Samsung and Xiaomi cameras save by default), and a very large one, where
// the full-size bitmap plus a canvas copy runs the tab out of memory. Both
// used to surface as one dead-end message — "That file could not be read as
// an image" — with nothing the person could do about it.
//
// So decoding is now three attempts, and failing all three is still not the
// end: the model itself reads HEIC quite happily, so an undecodable photo in
// a format the model knows is forwarded as it came.

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.8

// The formats worth forwarding undecoded. Gemini reads more than this, but
// these two are the only ones with a real browser gap: no Chrome decodes
// HEIC or HEIF, and recent Samsung and Xiaomi cameras save them by default.
// Anything else that will not decode is damaged rather than exotic, and
// saying so at once beats a three-megabyte round trip to find out.
const MODEL_READABLE = new Set(['image/heic', 'image/heif'])

// Vercel caps a serverless request body at 4.5 MB and base64 costs a third on
// top of the bytes, so ~4,000,000 characters (about 3 MB of photo) is as much
// as can be forwarded whole with room left for the JSON around it. A
// downscaled JPEG never comes close; an untouched HEIC can.
const MAX_BASE64 = 4_000_000

/** Magic bytes, because a phone gallery will hand over a file with no type. */
async function sniffType(file) {
  let head
  try {
    head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  } catch {
    return null
  }
  const ascii = (from, to) => String.fromCharCode(...head.slice(from, to))

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  // ISO base media: the brand sits right after "ftyp".
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    const heif = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']
    if (heif.includes(brand)) return brand.startsWith('hev') ? 'image/heif' : 'image/heic'
  }
  return null
}

function decodeViaElement(src) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode failed'))
    el.src = src
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/**
 * Decode to something drawable, or null if no route works.
 * Returns an ImageBitmap or an HTMLImageElement — both are valid drawImage
 * sources and both carry .width / .height.
 */
async function decode(file) {
  // createImageBitmap first: it decodes off the main thread, needs no second
  // full-size copy, and reaches a few formats the <img> path does not.
  // 'from-image' is explicit so a photo taken in portrait lands the same way
  // round as it did under the old <img> path — Chrome honours EXIF there, and
  // sideways text is text a model reads badly.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Older engines reject the options argument outright.
      try {
        return await createImageBitmap(file)
      } catch {
        // fall through to the element paths
      }
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await decodeViaElement(url)
  } catch {
    // fall through
  } finally {
    URL.revokeObjectURL(url)
  }

  // A data URL costs a copy but survives the cases where a blob URL is
  // refused — some in-app browsers block them.
  try {
    return await decodeViaElement(await readAsDataUrl(file))
  } catch {
    return null
  }
}

/**
 * Prepare a photo for a vision model.
 * Resolves to { data, mimeType } where data is base64 with no prefix:
 * a downscaled JPEG when the browser could decode the photo, otherwise the
 * original bytes when the model can read them itself.
 */
export async function toModelImage(file) {
  if (!file || file.size === 0) {
    throw new Error(
      'That photo came back empty. If it lives in Google Photos, open it once so it downloads to the phone, then try again.'
    )
  }

  const source = await decode(file)

  if (source) {
    try {
      const width = source.width || source.naturalWidth
      const height = source.height || source.naturalHeight
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' }
    } finally {
      // An ImageBitmap holds its pixels until it is closed, which matters on
      // a phone that has just decoded a 50-megapixel photo.
      if (typeof source.close === 'function') source.close()
    }
  }

  // Nothing here could open it. The format has to be read out of the bytes,
  // never off file.type: the photo that broke this in the first place arrived
  // declaring image/jpeg, and trusting that label would forward a file the
  // browser has just proved it cannot read.
  const mimeType = await sniffType(file)

  if (!mimeType || !MODEL_READABLE.has(mimeType)) {
    throw new Error(
      mimeType
        ? 'That photo looks damaged — the phone could not open it. If it came from Google Photos, open it there once so it downloads in full, then try again.'
        : 'That file could not be read as an image. If it is a photo, try taking it again with the camera button.'
    )
  }

  const dataUrl = await readAsDataUrl(file)
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (data.length > MAX_BASE64) {
    throw new Error(
      'That photo is too large to send in a format we cannot shrink on the phone. Take it with the camera button instead, or save a smaller copy.'
    )
  }
  return { data, mimeType }
}
