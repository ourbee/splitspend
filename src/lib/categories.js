/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Best-effort category guess from the expense description. Display-only —
// nothing is stored, so an odd guess never corrupts anyone's data, and the
// mapping can be changed freely without a migration.
//
// Order matters: the first category whose pattern matches wins, so the more
// specific groups (drinks, groceries) are listed before the broader ones.
const CATEGORIES = [
  {
    key: 'drinks',
    emoji: '🍻',
    words: ['beer', 'bar', 'pub', 'wine', 'whisky', 'whiskey', 'rum', 'vodka', 'gin',
      'cocktail', 'drink', 'drinks', 'alcohol', 'liquor', 'booze', 'brewery'],
  },
  {
    key: 'groceries',
    emoji: '🛒',
    words: ['grocery', 'groceries', 'supermarket', 'kirana', 'bigbasket', 'blinkit',
      'zepto', 'dmart', 'provisions', 'vegetables', 'veggies', 'sabzi', 'milk', 'eggs'],
  },
  {
    key: 'food',
    emoji: '🍽️',
    words: ['food', 'lunch', 'dinner', 'breakfast', 'brunch', 'meal', 'meals',
      'restaurant', 'cafe', 'café', 'coffee', 'chai', 'tea', 'snack', 'snacks',
      'pizza', 'burger', 'biryani', 'thali', 'dhaba', 'canteen', 'swiggy', 'zomato',
      'dessert', 'bakery', 'tiffin', 'khana', 'nashta', 'buffet', 'icecream',
      'ice cream', 'sweets', 'mithai', 'momo', 'momos', 'dosa', 'paratha'],
  },
  {
    key: 'transport',
    emoji: '🚗',
    words: ['cab', 'cabs', 'taxi', 'uber', 'ola', 'rapido', 'auto', 'rickshaw',
      'train', 'irctc', 'railway', 'flight', 'flights', 'plane', 'airline', 'airport',
      'petrol', 'diesel', 'fuel', 'bus', 'metro', 'toll', 'parking', 'ferry', 'boat',
      'transport', 'travel', 'car rental', 'bike rental', 'scooty', 'scooter', 'ride'],
  },
  {
    key: 'lodging',
    emoji: '🏠',
    words: ['hotel', 'stay', 'airbnb', 'hostel', 'room', 'rooms', 'lodge', 'lodging',
      'resort', 'homestay', 'guesthouse', 'guest house', 'dorm', 'camp', 'camping',
      'tent', 'rent', 'accommodation', 'checkin', 'check-in'],
  },
  {
    key: 'entertainment',
    emoji: '🎬',
    words: ['movie', 'movies', 'cinema', 'film', 'pvr', 'inox', 'concert', 'gig',
      'show', 'club', 'clubbing', 'party', 'bowling', 'arcade', 'karaoke', 'netflix',
      'ticket', 'tickets'],
  },
  {
    key: 'experience',
    emoji: '🎟️',
    words: ['trek', 'trekking', 'hike', 'hiking', 'museum', 'entry', 'entrance',
      'safari', 'guide', 'rafting', 'zoo', 'park', 'tour', 'sightseeing', 'temple',
      'fort', 'palace', 'boating', 'diving', 'snorkel', 'snorkelling', 'kayak',
      'paragliding', 'zipline', 'spa', 'activity', 'adventure', 'cruise'],
  },
  {
    key: 'shopping',
    emoji: '🛍️',
    words: ['shopping', 'clothes', 'shirt', 'tshirt', 'shoes', 'souvenir', 'souvenirs',
      'gift', 'gifts', 'mall', 'amazon', 'flipkart', 'myntra', 'bag', 'jacket'],
  },
  {
    key: 'health',
    emoji: '💊',
    words: ['medicine', 'medicines', 'medical', 'pharmacy', 'chemist', 'doctor',
      'hospital', 'clinic', 'meds', 'first aid', 'bandage'],
  },
  {
    key: 'connectivity',
    emoji: '📱',
    words: ['sim', 'recharge', 'data', 'wifi', 'internet', 'phone', 'mobile'],
  },
]

// Build one word-boundary regex per category, allowing an optional plural "s".
const MATCHERS = CATEGORIES.map((c) => ({
  ...c,
  re: new RegExp(`\\b(${c.words.map(escapeRegex).join('|')})s?\\b`, 'i'),
}))

const DEFAULT_CATEGORY = { key: 'other', emoji: '💸' }

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function categorize(description) {
  if (!description) return DEFAULT_CATEGORY
  const found = MATCHERS.find((c) => c.re.test(description))
  return found ? { key: found.key, emoji: found.emoji } : DEFAULT_CATEGORY
}

export function categoryEmoji(description) {
  return categorize(description).emoji
}
