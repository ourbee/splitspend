/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Reads a photographed travel document — boarding pass, ticket, booking,
// permit, itinerary — and returns text only. Same posture as the bill scanner
// beside it: the image exists in memory for one request and is never stored,
// here or anywhere else. What survives is a diary entry somebody can edit.
//
// This is the non-bill half of the same idea. It deliberately does NOT read
// prices: an event has no amount, and a ticket that cost something belongs on
// the expense side of the sheet.
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
 * would reject the field and be skipped by the retry loop. Reading a boarding
 * pass is transcription, not deliberation. See scan-receipt.js.
 */
function generationConfig(model) {
  const base = { response_mime_type: 'application/json', temperature: 0 }
  return model.startsWith('gemini-3')
    ? { ...base, thinkingConfig: { thinkingLevel: 'low' } }
    : base
}

const PROMPT = `This photo is a travel document — a boarding pass, train or bus ticket, hotel or tour booking, entry pass, permit, itinerary, or a sign at a place. Extract what it says and reply with ONLY a JSON object, no markdown fences, in this exact shape:
{
  "kind": string or null,     // what the document is, e.g. "boarding pass", "train ticket", "hotel booking", "museum entry", "sign"
  "title": string or null,    // a short diary heading, under 60 characters, e.g. "Flight to Hyderabad (6E 763)" or "Checked in at Hotel Sitara"
  "date": string or null,     // the date the document is FOR, as YYYY-MM-DD, if visible
  "details": string or null,  // anything notable that the fields below do not already carry — 1-4 short lines separated by newlines
  "travel": {                 // ticket particulars; null when the document is not a ticket or booking
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
Rules:
- Copy printed values exactly. Never guess, correct or invent anything that is not legible — use null instead.
- The ticket particulars go in "travel", one bare value per field — "B4", not "Coach B4" — and never a value that is not legible. Leave "travel" null only when the document involves no journey or booking at all.
- "details" is then for what "travel" has no field for: terminal, hotel name, room, tour or guide, place name, anything printed that a person would want to remember. Do not repeat there what the travel fields already hold.
- Do NOT include any price, fare, total, or payment amount anywhere. Do not include card numbers, CVV, passport numbers, or government ID numbers, even if they are printed. A PNR or booking reference is wanted; those are not.
- Write plainly, not as a form dump. "Kolkata to Chennai, 6E 763, dep 06:40, seat 14A" beats a list of labels.
- If the photo is not a document or a sign at all, use null for every field and null for travel.`

const clean = (value, limit) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null

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

      // Nothing the model returns is trusted to be the shape it was asked for.
      // A date is kept only if it is a real calendar date in the printed form.
      const date = clean(parsed.date, 10)
      res.status(200).json({
        ok: true,
        kind: clean(parsed.kind, 40),
        title: clean(parsed.title, 90),
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        details: clean(parsed.details, 600),
        travel: cleanTravel(parsed.travel),
      })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not read that photo: ${lastError}` })
}
