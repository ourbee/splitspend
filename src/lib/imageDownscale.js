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
const QUALITY = 0.8

// WebP where the browser can encode it: on a photographed bill it comes out
// roughly a third smaller than JPEG at the same quality, which is a third less
// to upload before anybody sees a result. Gemini reads it either way. Safari
// only learned canvas WebP in 14, hence the check rather than the assumption.
let webpSupported = null
function canEncodeWebp() {
  if (webpSupported === null) {
    try {
      const probe = document.createElement('canvas')
      probe.width = 1
      probe.height = 1
      webpSupported = probe.toDataURL('image/webp').startsWith('data:image/webp')
    } catch {
      webpSupported = false
    }
  }
  return webpSupported
}

/** canvas.toBlob, promised. Unlike toDataURL it never builds a base64 string. */
function encode(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('That photo could not be re-encoded'))),
      mimeType,
      QUALITY
    )
  })
}

// The formats worth forwarding undecoded. Gemini reads more than this, but
// these two are the only ones with a real browser gap: no Chrome decodes
// HEIC or HEIF, and recent Samsung and Xiaomi cameras save them by default.
// Anything else that will not decode is damaged rather than exotic, and
// saying so at once beats a three-megabyte round trip to find out.
const MODEL_READABLE = new Set(['image/heic', 'image/heif'])

// Vercel caps a serverless request body at 4.5 MB. Raw bytes go up now, so
// this is the photo's own size rather than a base64 figure a third larger.
// A downscaled photo never comes close; an untouched HEIC can.
const MAX_BYTES = 3_500_000

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
 * Resolves to { blob, mimeType }: a downscaled WebP or JPEG when the browser
 * could decode the photo, otherwise the original file when the model can read
 * it and the browser cannot.
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

      const mimeType = canEncodeWebp() ? 'image/webp' : 'image/jpeg'
      const blob = await encode(canvas, mimeType)
      // toBlob falls back to PNG when it does not recognise the type, which
      // would be several times larger than the photo we started with.
      if (blob.type === mimeType) return { blob, mimeType }
      return { blob: await encode(canvas, 'image/jpeg'), mimeType: 'image/jpeg' }
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

  if (file.size > MAX_BYTES) {
    throw new Error(
      'That photo is too large to send in a format we cannot shrink on the phone. Take it with the camera button instead, or save a smaller copy.'
    )
  }
  return { blob: file, mimeType }
}
