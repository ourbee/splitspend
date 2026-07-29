/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

const KEY = 'splitspend_recent'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

export function rememberTrip(tripId, name) {
  const all = load()
  all[tripId] = { name, at: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getRecentTrips() {
  return Object.entries(load())
    .map(([id, v]) => ({ id, name: v.name, at: v.at }))
    .sort((a, b) => b.at - a.at)
}

export function forgetTrip(tripId) {
  const all = load()
  delete all[tripId]
  localStorage.setItem(KEY, JSON.stringify(all))
}
