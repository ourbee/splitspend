/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// The fixed spending taxonomy the Reports tab groups by.
//
// It lives in the client, not the database, on purpose: it is a presentation
// concern, and keeping it here means the heads can be re-cut without a
// migration. The columns in Postgres only promise the stored labels are short.
//
// Two rules this file exists to enforce:
//
//   1. A model labelling an expense must CHOOSE from this list. Left open
//      ended it invents thirty heads and the donut shatters into confetti.
//      resolveLabel() below is the gate every label passes through, whether
//      it came from the keyword matcher, from Gemini, or from a hand override.
//
//   2. Colour follows the category, never its size. Slot order here is the
//      slice order in the donut and the colour each head keeps for ever, so a
//      filter or a quiet day can never repaint the survivors.
//
// Colours are the validated categorical palette, adjacent-pair checked against
// this exact order on a white surface (worst CVD ΔE 9.1, worst normal-vision
// ΔE 19.6). Three of them sit under 3:1 against white, which obliges the
// relief the Reports tab ships anyway: direct labels plus the full breakdown
// table underneath. Do not reorder without re-running the validator.

export const TAXONOMY = [
  {
    key: 'food',
    label: 'Food & Drink',
    emoji: '🍽️',
    color: '#2a78d6',
    fallbackSub: 'eatingout',
    subs: [
      { key: 'breakfast', label: 'Breakfast', emoji: '🥐',
        words: ['breakfast', 'brunch', 'nashta', 'tiffin'] },
      { key: 'lunch', label: 'Lunch', emoji: '🍛',
        words: ['lunch', 'thali'] },
      { key: 'dinner', label: 'Dinner', emoji: '🍲',
        words: ['dinner', 'supper'] },
      { key: 'drinks', label: 'Drinks', emoji: '🍻',
        words: ['beer', 'bar', 'pub', 'wine', 'whisky', 'whiskey', 'rum', 'vodka',
          'gin', 'cocktail', 'drink', 'drinks', 'alcohol', 'liquor', 'booze', 'brewery'] },
      { key: 'cafe', label: 'Snacks & Café', emoji: '☕',
        words: ['cafe', 'café', 'coffee', 'chai', 'tea', 'snack', 'snacks', 'bakery',
          'dessert', 'icecream', 'ice cream', 'sweets', 'mithai', 'momo', 'momos', 'samosa'] },
      { key: 'groceries', label: 'Groceries', emoji: '🛒',
        words: ['grocery', 'groceries', 'supermarket', 'kirana', 'bigbasket', 'blinkit',
          'zepto', 'dmart', 'provisions', 'vegetables', 'veggies', 'sabzi', 'milk', 'eggs'] },
      { key: 'eatingout', label: 'Eating Out', emoji: '🍽️',
        words: ['restaurant', 'dhaba', 'canteen', 'swiggy', 'zomato', 'buffet', 'food',
          'meal', 'meals', 'pizza', 'burger', 'biryani', 'dosa', 'paratha', 'khana'] },
    ],
  },
  {
    key: 'localtravel',
    label: 'Local Travel',
    emoji: '🚕',
    color: '#eb6834',
    fallbackSub: 'taxi',
    subs: [
      { key: 'taxi', label: 'Taxi & Auto', emoji: '🚕',
        words: ['cab', 'cabs', 'taxi', 'uber', 'ola', 'rapido', 'auto', 'rickshaw', 'ride'] },
      { key: 'busmetro', label: 'Bus & Metro', emoji: '🚌',
        words: ['bus', 'metro', 'tram'] },
      { key: 'fuel', label: 'Fuel & Parking', emoji: '⛽',
        words: ['petrol', 'diesel', 'fuel', 'toll', 'parking'] },
      { key: 'rentals', label: 'Rentals', emoji: '🛵',
        words: ['scooty', 'scooter', 'car rental', 'bike rental', 'rental'] },
    ],
  },
  {
    key: 'longtravel',
    label: 'Long Travel',
    emoji: '✈️',
    color: '#1baf7a',
    fallbackSub: 'flights',
    subs: [
      { key: 'flights', label: 'Flights', emoji: '✈️',
        words: ['flight', 'flights', 'plane', 'airline', 'airport', 'indigo', 'vistara'] },
      { key: 'trains', label: 'Trains', emoji: '🚆',
        words: ['train', 'irctc', 'railway', 'rail'] },
      { key: 'ferries', label: 'Ferries & Boats', emoji: '⛴️',
        words: ['ferry', 'boat', 'cruise'] },
    ],
  },
  {
    key: 'stay',
    label: 'Stay',
    emoji: '🏨',
    color: '#eda100',
    fallbackSub: 'hotel',
    subs: [
      { key: 'hotel', label: 'Hotel', emoji: '🏨',
        words: ['hotel', 'resort', 'lodge', 'lodging', 'accommodation', 'checkin',
          'check-in', 'room', 'rooms', 'stay'] },
      { key: 'homestay', label: 'Hostel & Homestay', emoji: '🏠',
        words: ['hostel', 'airbnb', 'homestay', 'guesthouse', 'guest house', 'dorm'] },
      { key: 'camping', label: 'Camping', emoji: '⛺',
        words: ['camp', 'camping', 'tent'] },
    ],
  },
  {
    key: 'experiences',
    label: 'Tickets & Experiences',
    emoji: '🎟️',
    color: '#e87ba4',
    fallbackSub: 'entry',
    subs: [
      // Nightlife sits above Entry & Tours so "movie tickets" lands on the
      // show rather than being claimed by the bare word "ticket".
      { key: 'nightlife', label: 'Shows & Nightlife', emoji: '🎬',
        words: ['movie', 'movies', 'cinema', 'film', 'pvr', 'inox', 'concert', 'gig',
          'show', 'club', 'clubbing', 'party', 'bowling', 'arcade', 'karaoke'] },
      { key: 'activities', label: 'Activities', emoji: '🥾',
        words: ['trek', 'trekking', 'hike', 'hiking', 'rafting', 'boating', 'diving',
          'snorkel', 'snorkelling', 'kayak', 'paragliding', 'zipline', 'adventure',
          'activity', 'spa'] },
      { key: 'entry', label: 'Entry & Tours', emoji: '🎟️',
        words: ['entry', 'entrance', 'ticket', 'tickets', 'museum', 'zoo', 'temple',
          'fort', 'palace', 'tour', 'sightseeing', 'guide', 'safari', 'park'] },
    ],
  },
  {
    key: 'shopping',
    label: 'Shopping',
    emoji: '🛍️',
    color: '#008300',
    fallbackSub: 'essentials',
    subs: [
      { key: 'souvenirs', label: 'Souvenirs', emoji: '🎁',
        words: ['souvenir', 'souvenirs', 'gift', 'gifts', 'handicraft'] },
      { key: 'clothing', label: 'Clothing', emoji: '👕',
        words: ['clothes', 'shirt', 'tshirt', 'shoes', 'jacket', 'bag', 'myntra'] },
      { key: 'essentials', label: 'Essentials', emoji: '🧴',
        words: ['toiletries', 'shampoo', 'soap', 'sunscreen', 'amazon', 'flipkart',
          'mall', 'shopping'] },
    ],
  },
  {
    key: 'other',
    label: 'Other',
    emoji: '💸',
    color: '#4a3aa7',
    fallbackSub: 'misc',
    subs: [
      { key: 'health', label: 'Health', emoji: '💊',
        words: ['medicine', 'medicines', 'medical', 'pharmacy', 'chemist', 'doctor',
          'hospital', 'clinic', 'meds', 'first aid', 'bandage'] },
      { key: 'connectivity', label: 'Connectivity', emoji: '📱',
        words: ['sim', 'recharge', 'data', 'wifi', 'internet', 'phone', 'mobile'] },
      { key: 'fees', label: 'Tips & Fees', emoji: '🧾',
        words: ['tip', 'tips', 'service charge', 'fee', 'fees', 'commission', 'atm'] },
      // No words: the bucket everything unrecognised falls into.
      { key: 'misc', label: 'Miscellaneous', emoji: '💸', words: [] },
    ],
  },
]

export const OTHER_CATEGORY = TAXONOMY[TAXONOMY.length - 1]
export const DEFAULT_SUB = OTHER_CATEGORY.subs[OTHER_CATEGORY.subs.length - 1]

const BY_CATEGORY_LABEL = new Map(TAXONOMY.map((c) => [c.label.toLowerCase(), c]))
const SUB_BY_LABEL = new Map()
for (const cat of TAXONOMY) {
  for (const sub of cat.subs) {
    SUB_BY_LABEL.set(`${cat.label.toLowerCase()}|${sub.label.toLowerCase()}`, { cat, sub })
  }
}

/** Every category label, in slice order — the menu a model must choose from. */
export const CATEGORY_LABELS = TAXONOMY.map((c) => c.label)

/** The "if in doubt" subcategory for a head. */
function fallbackSubOf(category) {
  return category.subs.find((s) => s.key === category.fallbackSub) || category.subs[0]
}

/**
 * Snap a (category, subcategory) pair onto the taxonomy.
 *
 * This is the gate: anything that doesn't match a real head is pulled back to
 * Other/Miscellaneous rather than becoming a new slice. Matching is
 * case-insensitive and tolerates a subcategory arriving without its parent.
 *
 * @returns {{ category, sub }} always a real pair, never null
 */
export function resolveLabel(categoryLabel, subLabel) {
  const cat = BY_CATEGORY_LABEL.get(String(categoryLabel || '').trim().toLowerCase())

  if (cat) {
    const exact = SUB_BY_LABEL.get(
      `${cat.label.toLowerCase()}|${String(subLabel || '').trim().toLowerCase()}`
    )
    // A recognised head with an unrecognised sub keeps the head — losing the
    // whole expense to Other over a bad sub-label would be the worse trade.
    // The head's declared fallbackSub takes it, not simply the first one in
    // the list: falling back to subs[0] would file every unplaceable Food
    // expense under "Breakfast", which reads as a fact rather than a shrug.
    return { category: cat, sub: exact ? exact.sub : fallbackSubOf(cat) }
  }

  // No category, but a subcategory we know? Take its parent.
  if (subLabel) {
    const needle = String(subLabel).trim().toLowerCase()
    for (const c of TAXONOMY) {
      const found = c.subs.find((s) => s.label.toLowerCase() === needle)
      if (found) return { category: c, sub: found }
    }
  }

  return { category: OTHER_CATEGORY, sub: DEFAULT_SUB }
}

/** The colour a category always wears. Unknown labels get Other's. */
export function categoryColor(categoryLabel) {
  return (BY_CATEGORY_LABEL.get(String(categoryLabel || '').trim().toLowerCase())
    || OTHER_CATEGORY).color
}
