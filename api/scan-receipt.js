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
import { readImage } from './_imageBody.js'
import { cleanTravel } from './_travel.js'

const MODEL_PREFERENCES = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
]

/**
 * Only the Gemini 3 line takes thinkingLevel; the 2.5-era fallbacks below it
 * would reject the field and be skipped by the retry loop. Reading a bill is
 * transcription, not deliberation — left to reason freely the model spent
 * ~840 thinking tokens on a four-line restaurant bill and roughly doubled the
 * time somebody sits watching a spinner.
 */
function generationConfig(model) {
  const base = { response_mime_type: 'application/json', temperature: 0 }
  return model.startsWith('gemini-3')
    ? { ...base, thinkingConfig: { thinkingLevel: 'low' } }
    : base
}

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
  ],
  "travel": {                   // ticket particulars; null when this is not a travel ticket
    "operator": string or null,      // airline, railway or bus company, e.g. "IndiGo", "IRCTC", "VRL Travels"
    "service": string or null,       // flight/train/bus number and name, e.g. "6E 763", "12841 Coromandel Express"
    "from": string or null,          // origin as printed, station/airport/stop
    "to": string or null,            // destination as printed
    "pnr": string or null,           // PNR, booking reference or ticket number
    "seat": string or null,          // seat or berth, e.g. "14A", "32 LB"
    "coach": string or null,         // coach or bogie, trains and some buses only, e.g. "B4", "S7"
    "seat_class": string or null,    // class of travel, e.g. "3A", "Sleeper", "Economy", "AC Seater"
    "boarding_time": string or null, // boarding time as printed, e.g. "21:35"
    "departure_time": string or null,// departure time as printed
    "gate": string or null,          // gate, flights only
    "platform": string or null       // platform, trains only
  }
}
Rules for "items":
- Copy the printed prices exactly. Never calculate, correct, or infer a price that is not legible — use null instead.
- Do not include subtotal, tax, service charge, discount or grand-total rows as items.
- If the bill shows only one price per line, put it in "amount" and leave "unit_price" null.
Rules for "travel":
- Fill this in whenever the bill is a ticket or a booking of any kind — flight, train, bus, ferry, cab, hotel, tour, entry pass. Use null for "travel" itself only when the purchase involves no journey or booking at all.
- Copy every value exactly as printed. Never guess a seat, a time or a reference that is not legible — use null.
- Put the bare value in each field, without repeating its label: "B4", not "Coach B4".
- When "travel" is filled in, "summary" must not repeat any of it — no route, service number, seat, coach, class, time, gate, platform or reference. Those are printed from the fields. Use "summary" only for what is left, such as what a meal or a booking included, and use null when nothing is left.
- Never return a card number, CVV, passport number or government ID number in any field, even where one is printed. A PNR or booking reference is wanted; those are not.
If the photo is not a bill at all, use null for every field, [] for items and null for travel.`

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

  // Raw bytes with the format in Content-Type, or the older base64-in-JSON
  // shape that a bundle still cached on a phone will keep sending.
  const body = await readImage(req)
  if (body.error) {
    res.status(body.status).json({ ok: false, error: body.error })
    return
  }
  const { data: image, mimeType } = body

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
                { inline_data: { mime_type: mimeType, data: image } },
              ],
            }],
            generationConfig: generationConfig(model),
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
        travel: cleanTravel(parsed.travel),
      })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not read the bill: ${lastError}` })
}
