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
  "summary": string or null,    // 1-3 short lines listing the notable items, written as a note a person would keep; no currency symbols needed
  "items": [                    // one entry per line on the bill, in the order printed; [] if the lines are unreadable
    {
      "name": string,           // the item as printed, cleaned up
      "qty": string or null,    // quantity as printed, e.g. "2" or "1 kg"
      "unit_price": number or null,  // price for ONE unit, digits only
      "amount": number or null       // line total for this row, digits only
    }
  ]
}
Rules for "items":
- Copy the printed prices exactly. Never calculate, correct, or infer a price that is not legible — use null instead.
- Do not include subtotal, tax, service charge, discount or grand-total rows as items.
- If the bill shows only one price per line, put it in "amount" and leave "unit_price" null.
If the photo is not a bill at all, use null for every field and [] for items.`

// The model is told the shape but is not bound by it, so nothing it returns is
// trusted: rows without a readable name are dropped, numbers are coerced and
// only kept when positive, and the list is capped. A price that came back as
// "approx 240" becomes null rather than a number nobody printed.
const MAX_ITEMS = 200

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function cleanItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      const name = typeof item?.name === 'string' ? item.name.trim().slice(0, 120) : ''
      if (!name) return null
      return {
        name,
        qty: item?.qty == null ? null : String(item.qty).trim().slice(0, 24) || null,
        unit_price: num(item?.unit_price),
        amount: num(item?.amount),
      }
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
}

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
        items: cleanItems(parsed.items),
      })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not read the bill: ${lastError}` })
}
