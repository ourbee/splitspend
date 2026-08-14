/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Labels expense descriptions against a fixed taxonomy.
//
// The model's entire job here is to pick a name off a list. It is never told
// an amount, never asked to add anything up, and nothing it returns reaches a
// balance: every rupee in the Reports tab is summed in the browser from the
// stored expense amounts. Descriptions in, two labels out.
//
// The taxonomy arrives with the request rather than living here, so the client
// stays the single source of truth for what the heads are — changing them
// needs neither a deploy of this function nor a migration.
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

const MAX_ITEMS = 200

function buildPrompt(taxonomy, items) {
  const menu = taxonomy
    .map((c) => `- ${c.category}: ${c.subs.join(', ')}`)
    .join('\n')

  const list = items
    .map((it, i) => `${i + 1}. ${it.text}`)
    .join('\n')

  return `You are labelling expenses from a group trip so they can be grouped in a report.

Choose from THIS LIST ONLY. Never invent a category or a subcategory:
${menu}

Rules:
- Reply with ONLY a JSON object, no markdown fences.
- "labels" must have exactly one entry per numbered item, in the same order.
- "category" must be copied verbatim from the list above.
- "subcategory" must be copied verbatim from that category's own subcategories.
- If a description is too vague to place, use category "Other" and subcategory "Miscellaneous".
- Do not add, total, or comment on any amounts. Labels only.

Shape:
{ "labels": [ { "n": number, "category": string, "subcategory": string } ] }

Items to label:
${list}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' })
    return
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    res.status(500).json({ ok: false, error: 'Categorising is not configured on the server (missing GEMINI_API_KEY)' })
    return
  }

  // Items are { id, text }. The id is echoed back untouched so the client can
  // match rows up without trusting the model to preserve anything but order.
  const items = Array.isArray(req.body?.items)
    ? req.body.items
        .filter((it) => typeof it?.id === 'string' && typeof it?.text === 'string' && it.text.trim())
        .slice(0, MAX_ITEMS)
        .map((it) => ({ id: it.id, text: it.text.trim().slice(0, 200) }))
    : []

  const taxonomy = Array.isArray(req.body?.taxonomy)
    ? req.body.taxonomy
        .filter((c) => typeof c?.category === 'string' && Array.isArray(c?.subs))
        .map((c) => ({ category: c.category, subs: c.subs.filter((s) => typeof s === 'string') }))
    : []

  if (!items.length || !taxonomy.length) {
    res.status(400).json({ ok: false, error: 'Nothing to label' })
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
            contents: [{ parts: [{ text: buildPrompt(taxonomy, items) }] }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0,
            },
          }),
        }
      )

      if (!r.ok) {
        // Retired model (404), rate limit (429), or overload (5xx): try the
        // next preference rather than failing the whole batch.
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

      const rows = Array.isArray(parsed?.labels) ? parsed.labels : []
      // Positions are 1-based in the prompt and may come back out of order or
      // short. Anything unmatched is simply left out and stays unlabelled —
      // better a missing label than one pinned to the wrong expense.
      const labels = []
      for (const row of rows) {
        const index = Number(row?.n) - 1
        const item = items[index]
        if (!item) continue
        labels.push({
          id: item.id,
          category: typeof row.category === 'string' ? row.category.slice(0, 40) : null,
          subcategory: typeof row.subcategory === 'string' ? row.subcategory.slice(0, 40) : null,
        })
      }

      res.status(200).json({ ok: true, labels })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not label these expenses: ${lastError}` })
}
