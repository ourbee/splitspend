/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { EXPERIENCE_EMOJI_GROUPS } from './experiences'

// A curated set rather than the full system emoji keyboard: it is far quicker
// to thumb through on a phone, and it keeps the visual language of the expense
// list coherent. Grouped along the same lines the auto-guess uses.
export const EXPENSE_EMOJI_GROUPS = [
  {
    label: 'Food & drink',
    emojis: ['🍽️', '☕', '🍕', '🍔', '🍜', '🍛', '🥘', '🍰', '🍦', '🍻', '🍷'],
  },
  {
    label: 'Getting around',
    emojis: ['🚗', '🚕', '🛺', '🚌', '🚆', '✈️', '⛽', '🚲', '🛥️', '🅿️'],
  },
  {
    label: 'Stay',
    emojis: ['🏠', '🏨', '⛺', '🏝️'],
  },
  {
    label: 'Fun',
    emojis: ['🎬', '🎟️', '🎵', '🎮', '🎉', '🎨'],
  },
  {
    label: 'Out & about',
    emojis: ['🏞️', '🏛️', '🎢', '🧗', '🏊', '🛕'],
  },
  {
    label: 'Everything else',
    emojis: ['🛒', '🛍️', '🎁', '👕', '💊', '📱', '🧾', '💸'],
  },
  // An expense can be a memory too — the ferry ticket you'd rather remember
  // as the ferry. The experience registers are offered here as one section
  // rather than repeating them by hand in two files.
  {
    label: 'Experiences',
    emojis: [...new Set(EXPERIENCE_EMOJI_GROUPS.flatMap((g) => g.emojis))],
  },
]

// What an event's icon picker shows: the experience registers first, in full,
// then everything the expense sheet offers — a diary event about a meal is
// still allowed to be a plate of food.
export const EVENT_EMOJI_GROUPS = [
  ...EXPERIENCE_EMOJI_GROUPS,
  ...EXPENSE_EMOJI_GROUPS.filter((group) => group.label !== 'Experiences'),
]
