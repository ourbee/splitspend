/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

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
]
