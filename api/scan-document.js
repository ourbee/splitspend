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
const MODEL_PREFERENCES = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
]

const PROMPT = `This photo is a travel document — a boarding pass, train or bus ticket, hotel or tour booking, entry pass, permit, itinerary, or a sign at a place. Extract what it says and reply with ONLY a JSON object, no markdown fences, in this exact shape:
{
  "kind": string or null,     // what the document is, e.g. "boarding pass", "train ticket", "hotel booking", "museum entry", "sign"
  "title": string or null,    // a short diary heading, under 60 characters, e.g. "Flight to Hyderabad (6E 763)" or "Checked in at Hotel Sitara"
  "date": string or null,     // the date the document is FOR, as YYYY-MM-DD, if visible
  "details": string or null   // the significant particulars, 1-4 short lines separated by newlines
}
Rules:
- Copy printed values exactly. Never guess, correct or invent anything that is not legible — use null instead.
- "details" is for what a person would want to remember later: route, times, seat or coach, gate, terminal, platform, hotel name, room, confirmation or PNR reference, operator, place name.
- Do NOT include any price, fare, total, or payment amount. Do not include card numbers, CVV, passport numbers, or government ID numbers, even if they are printed.
- Write plainly, not as a form dump. "Kolkata to Chennai, 6E 763, dep 06:40, seat 14A" beats a list of labels.
- If the photo is not a document or a sign at all, use null for every field.`

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

  const image = req.body?.image
  if (typeof image !== 'string' || image.length < 100) {
    res.status(400).json({ ok: false, error: 'No image received' })
    return
  }
  // The client downscales to ~1280px JPEG; anything hugely bigger is not ours.
  // The exception is a photo the browser could not decode (a HEIC one, say),
  // which is forwarded untouched — still under this ceiling, which is set by
  // the platform's 4.5MB request body limit rather than by us.
  if (image.length > 4_000_000) {
    res.status(413).json({ ok: false, error: 'Image too large' })
    return
  }

  // Whatever the client managed to prepare. Restricted to the formats the
  // model documents as inline data, so a bad value cannot be relayed onward.
  const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  const mimeType = MIME_TYPES.includes(req.body?.mimeType) ? req.body.mimeType : 'image/jpeg'

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

      // Nothing the model returns is trusted to be the shape it was asked for.
      // A date is kept only if it is a real calendar date in the printed form.
      const date = clean(parsed.date, 10)
      res.status(200).json({
        ok: true,
        kind: clean(parsed.kind, 40),
        title: clean(parsed.title, 90),
        date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        details: clean(parsed.details, 600),
      })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not read that photo: ${lastError}` })
}
