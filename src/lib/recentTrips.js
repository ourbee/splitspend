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

// Union with another list (the Safari → Home Screen handoff); the newer
// timestamp wins for a group both sides already know.
export function mergeRecentTrips(trips) {
  const all = load()
  for (const t of trips) {
    const mine = all[t.id]
    if (!mine || (t.at || 0) > (mine.at || 0)) all[t.id] = { name: t.name, at: t.at || Date.now() }
  }
  localStorage.setItem(KEY, JSON.stringify(all))
}

// Fold in the server's list of groups this device has joined. Groups the
// device opened recently keep their place; the server's name wins, since a
// group can be renamed elsewhere. Returns true if the list changed.
export function syncRecentTrips(rows) {
  const all = load()
  let changed = false
  for (const r of rows) {
    const mine = all[r.id]
    if (!mine) {
      all[r.id] = { name: r.name, at: r.at }
      changed = true
    } else if (r.name && mine.name !== r.name) {
      mine.name = r.name
      changed = true
    }
  }
  if (changed) localStorage.setItem(KEY, JSON.stringify(all))
  return changed
}
