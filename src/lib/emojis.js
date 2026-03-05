export const EMOJI_OPTIONS = [
  '😀', '😎', '🤓', '🥳', '😇',
  '🦊', '🐱', '🐶', '🐼', '🦁',
  '🌟', '🔥', '💎', '🎯', '🚀',
  '🎨', '🎵', '🌈', '🍕', '☕',
]

export function getRandomEmoji(usedEmojis = []) {
  const available = EMOJI_OPTIONS.filter(e => !usedEmojis.includes(e))
  if (available.length === 0) return EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)]
  return available[Math.floor(Math.random() * available.length)]
}
