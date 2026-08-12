/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useEffect, useState } from 'react'

// A single button that flips direction instead of two competing ones — the
// "+" button already owns the bottom-right corner, and two more floating
// controls would crowd a phone screen. Only appears once the list is long
// enough that scrolling is actually a chore.
const MIN_SCROLLABLE = 1.8 // viewport heights
const NEAR_TOP = 240 // px

export default function ScrollJump() {
  const [visible, setVisible] = useState(false)
  const [direction, setDirection] = useState('down')

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement
      setVisible(doc.scrollHeight > window.innerHeight * MIN_SCROLLABLE)
      setDirection(window.scrollY > NEAR_TOP ? 'up' : 'down')
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // The list length changes as expenses are added, deleted or filtered
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [])

  if (!visible) return null

  const jump = () => {
    window.scrollTo({
      top: direction === 'up' ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth',
    })
  }

  return (
    <button
      className="scroll-jump"
      onClick={jump}
      title={direction === 'up' ? 'Back to top' : 'Jump to bottom'}
      aria-label={direction === 'up' ? 'Back to top' : 'Jump to bottom'}
    >
      {direction === 'up' ? '↑' : '↓'}
    </button>
  )
}
