/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Reads a photographed bill with Gemini and returns text only — the image
// exists in memory for one request and is never stored anywhere.
//
// Model preferences follow the same reality found in ClaimGuard (2026-07-11):
// "gemini-2.5-flash(-lite)" still appear in the live model list but 404 for
// new keys, and "gemini-flash-latest" is a slow thinker prone to malformed
// JSON — so it stays last. Override without a deploy by setting GEMINI_MODEL.
const MODEL_PREFERENCES = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
]

const PROMPT = `This photo is a receipt, bill, or invoice. Extract what it says and reply with ONLY a JSON object, no markdown fences, in this exact shape:
{
  "merchant": string or null,   // shop/restaurant/vendor name, cleaned up
  "amount": number or null,     // the grand total actually paid, digits only
  "date": string or null,       // bill date as YYYY-MM-DD if visible
  "summary": string or null     // 1-3 short lines listing the notable items, written as a note a person would keep; no currency symbols needed
}
If the photo is not a bill at all, use null for every field.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' })
    return
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    res.status(500).json({ ok: false, error: 'Scanning is not configured on the server (missing GEMINI_API_KEY)' })
    return
  }

  const image = req.body?.image
  if (typeof image !== 'string' || image.length < 100) {
    res.status(400).json({ ok: false, error: 'No image received' })
    return
  }
  // The client downscales to ~1280px JPEG; anything hugely bigger is not ours.
  if (image.length > 4_000_000) {
    res.status(413).json({ ok: false, error: 'Image too large' })
    return
  }

  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : MODEL_PREFERENCES

  let lastError = 'No model available'
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: image } },
              ],
            }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0,
            },
          }),
        }
      )

      if (!r.ok) {
        // Retired model (404), rate limit (429), or overload (5xx): try the
        // next preference rather than failing the scan.
        lastError = `Model ${model} replied ${r.status}`
        continue
      }

      const data = await r.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        lastError = `Model ${model} returned an empty reply`
        continue
      }

      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        lastError = `Model ${model} returned unparseable output`
        continue
      }

      res.status(200).json({
        ok: true,
        merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
        amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not read the bill: ${lastError}` })
}
