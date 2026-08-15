/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// What a diary event is about, guessed from its title.
//
// The same idea as categories.js, and the same reasons: free, offline,
// instant, deterministic — two phones looking at the same trip draw the same
// card. It runs at display time and nothing is stored, so editing "Sunset at
// Om Beach" into "Rained all evening" changes the icon and the colour with it.
//
// A group is not a spending category. Events have no amount and never reach
// the Reports tab; these registers exist to give the card a face and a warmth
// of its own. Expense cards wear the payer's colour — cool, saturated,
// per-person. Experiences wear parchment: warm, low-chroma, of a piece with
// each other, so a glance down the timeline still reads "money, money, memory,
// money" even now that the memories are no longer plain.

const GROUPS = [
  {
    key: 'nature',
    label: 'Outdoors',
    emoji: '🏞️',
    tint: '#f1f6ec',
    accent: '#6b8f4e',
    matches: [
      { emoji: '🌅', words: ['sunset', 'sunrise', 'golden hour', 'dawn', 'dusk'] },
      { emoji: '🏖️', words: ['beach', 'shore', 'sand', 'seaside', 'coast'] },
      { emoji: '🥾', words: ['trek', 'trekking', 'hike', 'hiking', 'walk', 'climb', 'summit'] },
      { emoji: '⛰️', words: ['mountain', 'hill', 'peak', 'valley', 'viewpoint', 'ghat'] },
      { emoji: '💦', words: ['waterfall', 'falls', 'spring', 'stream'] },
      { emoji: '🌊', words: ['sea', 'ocean', 'wave', 'waves', 'swim', 'snorkel', 'dive'] },
      { emoji: '🏕️', words: ['camp', 'camping', 'bonfire', 'campfire', 'tent'] },
      { emoji: '🌲', words: ['forest', 'jungle', 'woods', 'trail', 'park', 'garden'] },
      { emoji: '🦜', words: ['safari', 'wildlife', 'birds', 'birding', 'deer', 'tiger', 'elephant'] },
      { emoji: '🌌', words: ['stars', 'stargazing', 'night sky', 'milky way', 'moonlight'] },
      { emoji: '🛶', words: ['kayak', 'canoe', 'backwater', 'backwaters', 'lake', 'river'] },
    ],
  },
  {
    key: 'sacred',
    label: 'Sacred places',
    emoji: '🛕',
    tint: '#fbf1e4',
    accent: '#b4762c',
    matches: [
      { emoji: '🛕', words: ['temple', 'mandir', 'shrine', 'gopuram', 'darshan'] },
      { emoji: '⛪', words: ['church', 'cathedral', 'basilica', 'chapel'] },
      { emoji: '🕌', words: ['mosque', 'masjid', 'dargah'] },
      { emoji: '☸️', words: ['monastery', 'gompa', 'stupa', 'pagoda', 'buddha'] },
      { emoji: '🪔', words: ['aarti', 'puja', 'prayer', 'prayers', 'ghat', 'blessing'] },
      { emoji: '🧘', words: ['meditation', 'yoga', 'ashram', 'retreat', 'silence'] },
    ],
  },
  {
    key: 'heritage',
    label: 'Old places',
    emoji: '🏛️',
    tint: '#f5f1e7',
    accent: '#8a7a52',
    matches: [
      { emoji: '🏛️', words: ['museum', 'gallery', 'exhibition', 'archive', 'library'] },
      { emoji: '🏰', words: ['fort', 'palace', 'haveli', 'castle', 'citadel', 'mahal'] },
      { emoji: '🗿', words: ['ruins', 'caves', 'carvings', 'monument', 'heritage', 'ancient', 'archaeological'] },
      { emoji: '🚶', words: ['old city', 'heritage walk', 'city walk', 'lanes', 'bazaar', 'market walk'] },
      { emoji: '📖', words: ['guide', 'guided tour', 'history', 'story', 'legend'] },
    ],
  },
  {
    key: 'journey',
    label: 'Getting there',
    emoji: '🧳',
    tint: '#eef3f8',
    accent: '#4a7ba3',
    matches: [
      { emoji: '✈️', words: ['flight', 'flew', 'airport', 'boarding', 'boarding pass', 'landed', 'takeoff', 'layover', 'terminal'] },
      { emoji: '🚆', words: ['train', 'railway', 'platform', 'sleeper', 'coach', 'junction', 'station'] },
      { emoji: '⛴️', words: ['ferry', 'boat', 'jetty', 'cruise', 'sailing'] },
      { emoji: '🚌', words: ['bus', 'coach ride', 'overnight bus'] },
      { emoji: '🛣️', words: ['drive', 'driving', 'road trip', 'highway', 'roadside', 'pit stop', 'toll'] },
      { emoji: '🏨', words: ['checkin', 'check-in', 'checkout', 'check-out', 'hotel', 'homestay', 'guesthouse', 'guest house', 'hostel', 'room'] },
      { emoji: '🧳', words: ['packed', 'packing', 'luggage', 'bags', 'left for', 'set off', 'departure', 'arrival', 'arrived', 'reached'] },
    ],
  },
  {
    key: 'celebration',
    label: 'Occasions',
    emoji: '🎉',
    tint: '#fbeef2',
    accent: '#b8557f',
    matches: [
      { emoji: '🎂', words: ['birthday', 'cake cutting'] },
      { emoji: '💍', words: ['wedding', 'shaadi', 'engagement', 'anniversary', 'reception', 'mehendi', 'haldi'] },
      { emoji: '🎊', words: ['festival', 'diwali', 'holi', 'durga puja', 'pongal', 'onam', 'eid', 'christmas', 'new year'] },
      { emoji: '🥂', words: ['toast', 'celebration', 'celebrated', 'farewell', 'send off', 'send-off', 'cheers'] },
      { emoji: '🎶', words: ['concert', 'gig', 'music', 'dance', 'jam', 'karaoke', 'performance', 'show'] },
      { emoji: '🎆', words: ['fireworks', 'crackers', 'parade', 'procession'] },
    ],
  },
  {
    key: 'people',
    label: 'People',
    emoji: '🧑‍🤝‍🧑',
    tint: '#f4f0f9',
    accent: '#7a63ab',
    matches: [
      { emoji: '🧑‍🤝‍🧑', words: ['met', 'meeting', 'caught up', 'reunion', 'friends', 'friend'] },
      { emoji: '🏠', words: ['family', 'relatives', 'cousins', 'home', 'visited', 'hosts', 'host'] },
      { emoji: '📸', words: ['photo', 'photos', 'group photo', 'selfie', 'pictures'] },
      { emoji: '💬', words: ['conversation', 'chat', 'talked', 'story from', 'stranger', 'local'] },
    ],
  },
  {
    key: 'table',
    label: 'At the table',
    emoji: '🍽️',
    tint: '#fdf2e7',
    accent: '#c1652f',
    matches: [
      { emoji: '🍲', words: ['feast', 'thali', 'home cooked', 'home-cooked', 'cooked', 'kitchen'] },
      { emoji: '🥘', words: ['street food', 'food walk', 'tasting', 'first time trying', 'tried'] },
      { emoji: '☕', words: ['chai', 'coffee', 'tea stall', 'cafe', 'café', 'bakery'] },
      { emoji: '🍻', words: ['drinks', 'beer', 'bar', 'toddy', 'brewery', 'wine'] },
      { emoji: '🍨', words: ['dessert', 'sweets', 'mithai', 'ice cream', 'icecream'] },
    ],
  },
  {
    key: 'mishap',
    // Kept short like every other register label: it sits on one line of a
    // card footing beside "Added by …", and a long one pushes the name onto a
    // second line.
    label: 'Mishaps',
    emoji: '🌧️',
    tint: '#f1f1ef',
    accent: '#7a7a78',
    matches: [
      { emoji: '🌧️', words: ['rain', 'rained', 'storm', 'downpour', 'flood', 'wet'] },
      { emoji: '⏳', words: ['delay', 'delayed', 'late', 'waiting', 'queue', 'stuck', 'traffic', 'jam'] },
      { emoji: '❌', words: ['cancelled', 'canceled', 'missed', 'closed', 'shut', 'strike', 'bandh'] },
      { emoji: '🤒', words: ['sick', 'unwell', 'fever', 'stomach', 'hospital', 'doctor'] },
      { emoji: '🔧', words: ['breakdown', 'puncture', 'flat tyre', 'repair', 'lost', 'stolen'] },
    ],
  },
  {
    key: 'rest',
    label: 'Slow hours',
    emoji: '😌',
    tint: '#eff5f4',
    accent: '#4f8a80',
    matches: [
      { emoji: '😴', words: ['nap', 'slept', 'sleep', 'rested', 'rest day', 'lazy', 'lie in', 'lie-in'] },
      { emoji: '📚', words: ['read', 'reading', 'book', 'journal', 'wrote'] },
      { emoji: '💆', words: ['spa', 'massage', 'ayurveda', 'hot spring', 'sauna'] },
      { emoji: '🏊', words: ['pool', 'poolside', 'hammock', 'balcony', 'terrace', 'rooftop'] },
    ],
  },
]

// The register a card falls back to: parchment, no claim about what happened.
const DEFAULT_GROUP = {
  key: 'moment',
  label: 'A moment',
  emoji: '📍',
  tint: '#faf6ed',
  accent: '#9a8f78',
}

export const EXPERIENCE_GROUPS = GROUPS

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One word-boundary regex per emoji, flattened in declaration order, so the
// ordering above is what resolves an ambiguous title: "Temple by the beach"
// takes Outdoors' beach only if no earlier line matched.
const MATCHERS = []
for (const group of GROUPS) {
  for (const match of group.matches) {
    MATCHERS.push({
      group,
      emoji: match.emoji,
      re: new RegExp(`\\b(${match.words.map(escapeRegex).join('|')})s?\\b`, 'i'),
    })
  }
}

// Which register a hand-picked emoji belongs to, so choosing 🛕 by hand tints
// the card the same as typing "temple" would have.
const GROUP_BY_EMOJI = new Map()
for (const group of GROUPS) {
  GROUP_BY_EMOJI.set(group.emoji, group)
  for (const match of group.matches) {
    if (!GROUP_BY_EMOJI.has(match.emoji)) GROUP_BY_EMOJI.set(match.emoji, group)
  }
}

/**
 * Guess what an event title is about.
 * @returns {{ emoji: string, group: object, matched: boolean }}
 */
export function guessExperience(title) {
  if (title) {
    const hit = MATCHERS.find((m) => m.re.test(title))
    if (hit) return { emoji: hit.emoji, group: hit.group, matched: true }
  }
  return { emoji: DEFAULT_GROUP.emoji, group: DEFAULT_GROUP, matched: false }
}

/** The emoji an event card shows when nobody has picked one. */
export function experienceEmoji(title) {
  return guessExperience(title).emoji
}

/**
 * The parchment tint and accent an event card wears.
 *
 * A hand-picked emoji decides it when there is one — that is the choice the
 * person actually made — and the title's guess decides it otherwise.
 */
export function experienceStyle(event) {
  if (event?.emoji) {
    const group = GROUP_BY_EMOJI.get(event.emoji)
    if (group) return group
  }
  return guessExperience(event?.title).group
}

/** The experience registers as picker sections. */
export const EXPERIENCE_EMOJI_GROUPS = GROUPS.map((group) => ({
  label: group.label,
  emojis: [...new Set([group.emoji, ...group.matches.map((m) => m.emoji)])],
}))
