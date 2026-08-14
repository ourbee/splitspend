/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Best-effort category guess from the expense description, matched against the
// fixed taxonomy. Free, offline, instant and — unlike a model — deterministic,
// so two phones looking at the same trip always draw the same donut.
//
// This runs FIRST for every expense. Only descriptions it can't place fall
// through to the batched Gemini call in autoCategorise.js, which keeps the
// network out of the common path entirely.
//
// The emoji shown on a card comes from the SUBcategory, not the head, so the
// icons stay as specific as they were before the taxonomy existed: a beer is
// still 🍻 rather than a generic 🍽️.

import { TAXONOMY, DEFAULT_SUB, OTHER_CATEGORY } from './taxonomy'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One word-boundary regex per subcategory, allowing an optional plural "s".
// Flattened in taxonomy order, so the first match wins and the ordering
// decisions documented in taxonomy.js (nightlife above entry, long travel
// above tickets) are what actually resolves ambiguous words like "ticket".
const MATCHERS = []
for (const category of TAXONOMY) {
  for (const sub of category.subs) {
    if (!sub.words.length) continue
    MATCHERS.push({
      category,
      sub,
      re: new RegExp(`\\b(${sub.words.map(escapeRegex).join('|')})s?\\b`, 'i'),
    })
  }
}

/**
 * Guess a description's place in the taxonomy.
 *
 * @returns {{ category, sub, matched }} matched is false when nothing hit and
 *   the result is the Other/Miscellaneous fallback — that flag is what marks an
 *   expense as worth asking Gemini about.
 */
export function guessLabel(description) {
  if (description) {
    const hit = MATCHERS.find((m) => m.re.test(description))
    if (hit) return { category: hit.category, sub: hit.sub, matched: true }
  }
  return { category: OTHER_CATEGORY, sub: DEFAULT_SUB, matched: false }
}

/**
 * The stored-label pair for a description, ready for the database.
 * @returns {{ category: string, subcategory: string, matched: boolean }}
 */
export function guessLabelStrings(description) {
  const { category, sub, matched } = guessLabel(description)
  return { category: category.label, subcategory: sub.label, matched }
}

/** Back-compat: the emoji a card falls back to when nobody picked one. */
export function categoryEmoji(description) {
  return guessLabel(description).sub.emoji
}
