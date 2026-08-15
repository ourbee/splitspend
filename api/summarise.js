/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Writes the paragraph the Trip Diary opens with.
//
// The model is a writer, never an accountant. Every figure it is allowed to
// use is computed in the browser and handed to it in the facts below; the
// prompt forbids arithmetic outright, and nothing that comes back is ever
// parsed for a number. If it hallucinates a total, that is a sentence a human
// can edit — it cannot move a rupee, because no balance is derived from this
// text.
//
// Two other deliberate constraints, both requested:
//   * No participant names travel with the request at all — only a count. The
//     paragraph speaks as "we".
//   * It runs only when somebody presses the button. Nothing here is on the
//     path of opening a trip.
//
// This is the slowest call in the app by a distance — five hundred words of
// generation against a whole trip's facts, measured at well over ten seconds.
// vercel.json therefore gives THIS function (and no other) a 60s maxDuration;
// without it the platform default cuts the request off mid-sentence and the
// button looks broken.
//
// Model preferences follow the same reality found in ClaimGuard (2026-07-11):
// "gemini-2.5-flash(-lite)" still appear in the live model list but 404 for
// new keys, and "gemini-flash-latest" is a slow thinker — so it stays last.
// Override without a deploy by setting GEMINI_MODEL.
const MODEL_PREFERENCES = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
]

const MAX_DAYS = 90
const MAX_ENTRIES_PER_DAY = 40
const MAX_ITEMS_PER_ENTRY = 12
const MAX_CATEGORIES = 12
const MIN_WORDS = 90
const MAX_WORDS = 500

const text = (value, limit) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

const money = (value) => (Number.isFinite(Number(value)) ? Number(value) : null)

/** Trim the client's fact sheet down to something bounded and typed. */
function cleanFacts(raw) {
  const days = Array.isArray(raw?.days) ? raw.days.slice(0, MAX_DAYS) : []

  return {
    currency: text(raw?.currency, 4) || '',
    people: Number.isFinite(Number(raw?.people)) ? Math.max(1, Math.round(Number(raw.people))) : null,
    total: money(raw?.total),
    dateRange: text(raw?.dateRange, 80),
    categories: (Array.isArray(raw?.categories) ? raw.categories : [])
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({ label: text(c?.label, 40), total: money(c?.total) }))
      .filter((c) => c.label),
    days: days.map((day) => ({
      date: text(day?.date, 40),
      spent: money(day?.spent),
      entries: (Array.isArray(day?.entries) ? day.entries : [])
        .slice(0, MAX_ENTRIES_PER_DAY)
        .map((entry) => ({
          kind: entry?.kind === 'event' ? 'event' : 'expense',
          text: text(entry?.text, 160),
          amount: money(entry?.amount),
          note: text(entry?.note, 240),
          items: (Array.isArray(entry?.items) ? entry.items : [])
            .slice(0, MAX_ITEMS_PER_ENTRY)
            .map((item) => text(item, 60))
            .filter(Boolean),
        }))
        .filter((entry) => entry.text),
    })).filter((day) => day.entries.length),
  }
}

/** The facts as a flat briefing. Plain lines read better than JSON here. */
function renderFacts(facts) {
  const lines = []
  const symbol = facts.currency

  if (facts.dateRange) lines.push(`Dates: ${facts.dateRange}`)
  if (facts.people) lines.push(`Group size: ${facts.people}`)
  if (facts.total != null) lines.push(`Total spent: ${symbol}${facts.total.toLocaleString('en-IN')}`)

  if (facts.categories.length) {
    lines.push('')
    lines.push('Where the money went:')
    for (const c of facts.categories) {
      lines.push(`- ${c.label}: ${symbol}${(c.total ?? 0).toLocaleString('en-IN')}`)
    }
  }

  for (const day of facts.days) {
    lines.push('')
    lines.push(day.spent ? `${day.date} (spent ${symbol}${day.spent.toLocaleString('en-IN')}):` : `${day.date}:`)
    for (const entry of day.entries) {
      const amount = entry.amount != null ? ` — ${symbol}${entry.amount.toLocaleString('en-IN')}` : ''
      const kind = entry.kind === 'event' ? '[moment] ' : ''
      lines.push(`- ${kind}${entry.text}${amount}`)
      if (entry.note) lines.push(`    note: ${entry.note}`)
      if (entry.items.length) lines.push(`    on the bill: ${entry.items.join(', ')}`)
    }
  }

  return lines.join('\n')
}

function buildPrompt(facts, words) {
  const symbol = facts.currency || ''
  return `You are writing the opening passage of a group's trip diary, from their own expense records.

Write ONE flowing passage of about ${words} words in plain, everyday English — the way someone would tell a friend what the trip was like over coffee. Contractions are fine. No headings, no bullet points, no markdown, no title.

Hard rules:
- Never name a person. The group is "we" and "us"${facts.people ? ` — there were ${facts.people} of us` : ''}. Places, dishes and landmarks keep their names.
- Every number you write must be copied exactly from the facts below. Never add, total, average, estimate or convert anything. If a figure is not listed, do not state one.
- Lines marked [moment] have no cost at all. Never attach a price to one — not even zero, not even "free".
- Most sentences should carry no figure at all. Pick out a handful worth mentioning and let the rest of the trip be described in words. A price is worth a mention when it was big, surprising, or the point of the day.
- Write money as ${symbol} before the digits, e.g. ${symbol}1,240.
- Mention only what appears in the facts. Do not invent a place, a meal, a journey or a feeling nobody recorded.
- Talk about days the way people do — "the first morning", "the next day", "that evening", or by weekday. Do not keep repeating the printed date.
- Never mention the category headings ("that was our local travel", "a big part of what we spent on food"). Those are bookkeeping, not conversation.
- Warm and ordinary, not travel-brochure. No exclamation marks, no "unforgettable", no "nestled".
- Follow the days in the order given. Give the memorable things — the food, the moments, the long journeys — more room than the routine ones.
- End with one short sentence about what the whole trip cost.

Reply with ONLY the passage.

FACTS
${renderFacts(facts)}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' })
    return
  }

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    res.status(500).json({ ok: false, error: 'Summaries are not configured on the server (missing GEMINI_API_KEY)' })
    return
  }

  const facts = cleanFacts(req.body?.facts)
  if (!facts.days.length) {
    res.status(400).json({ ok: false, error: 'Nothing to write about yet' })
    return
  }

  const requested = Number(req.body?.words)
  const words = Number.isFinite(requested)
    ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(requested)))
    : 300

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
            contents: [{ parts: [{ text: buildPrompt(facts, words) }] }],
            // Prose, so a little warmth is wanted here — unlike the labeller
            // and the bill reader, which both run at 0.
            generationConfig: { temperature: 0.6 },
          }),
        }
      )

      if (!r.ok) {
        // Retired model (404), rate limit (429), or overload (5xx): try the
        // next preference rather than failing the request.
        lastError = `Model ${model} replied ${r.status}`
        continue
      }

      const data = await r.json()
      const parts = data?.candidates?.[0]?.content?.parts
      const written = Array.isArray(parts)
        ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
        : ''

      if (!written) {
        lastError = `Model ${model} returned an empty reply`
        continue
      }

      // Stray markdown fences or a helpfully added title are stripped; the
      // diary wants a paragraph, not a document.
      const cleaned = written
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/```\s*$/, '')
        .replace(/^#+\s.*\n+/, '')
        .trim()
        .slice(0, 8000)

      res.status(200).json({ ok: true, summary: cleaned })
      return
    } catch (err) {
      lastError = String(err)
    }
  }

  res.status(502).json({ ok: false, error: `Could not write the summary: ${lastError}` })
}
