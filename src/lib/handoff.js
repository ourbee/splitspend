/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// Safari → Home Screen app handoff.
//
// On iPhone a web app added to the Home Screen gets its OWN storage, walled
// off from Safari's. Nothing in JS can read across that wall, so the app
// opens with an empty "Your Splitspends" list and a fresh device id — which
// also means it is not recognised as "you" in any group.
//
// The clipboard is the one thing both sides share. Safari copies a handoff
// link carrying its recent list, its device id and its per-group identity
// hints; the app pastes it and merges. No server change is involved.

import { getDeviceId, setDeviceId, linkDeviceId } from './deviceId'
import { getRecentTrips, mergeRecentTrips } from './recentTrips'

const ORIGIN = 'https://splitspend.vercel.app'
const MARK = '#bring='
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const identityKey = (tripId) => `splitspend_identity_${tripId}`
const creatorKey = (tripId) => `splitspend_creator_${tripId}`

// Home Screen launch: `navigator.standalone` is iOS's own flag; the media
// query covers every other platform.
export function isStandalone() {
  try {
    return window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

// iPadOS reports itself as a Mac, so touch points tell the two apart.
export function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function buildHandoff() {
  const trips = getRecentTrips().map((t) => [
    t.id,
    t.name,
    t.at,
    localStorage.getItem(identityKey(t.id)) || '',
    localStorage.getItem(creatorKey(t.id)) === 'true' ? 1 : 0,
  ])
  return `${ORIGIN}/${MARK}${toBase64Url(JSON.stringify({ v: 1, d: getDeviceId(), t: trips }))}`
}

// Whatever was pasted: a handoff link, a plain group link, or nothing usable.
export function parsePasted(text) {
  const raw = (text || '').trim()
  const at = raw.indexOf(MARK)
  if (at !== -1) {
    try {
      const data = JSON.parse(fromBase64Url(raw.slice(at + MARK.length).split(/\s/)[0]))
      if (data?.v === 1 && Array.isArray(data.t)) {
        const trips = data.t
          .filter((row) => Array.isArray(row) && UUID.test(String(row[0])))
          .map(([id, name, at, identity, creator]) => ({
            id: String(id).toLowerCase(),
            name: String(name || 'Untitled'),
            at: Number(at) || Date.now(),
            identity: UUID.test(String(identity || '')) ? String(identity) : '',
            creator: creator === 1,
          }))
        return { kind: 'handoff', deviceId: typeof data.d === 'string' ? data.d : '', trips }
      }
    } catch {
      // fall through — a damaged handoff is reported as unrecognised
    }
    return null
  }
  const trip = raw.match(new RegExp(`/trip/(${UUID.source})`, 'i'))
  if (trip) return { kind: 'trip', tripId: trip[1].toLowerCase() }
  return null
}

// Merge a handoff into this side's storage. Returns how many groups are new.
export function applyHandoff({ deviceId, trips }) {
  const before = new Set(getRecentTrips().map((t) => t.id))
  const hadOwnGroups = before.size > 0

  // Adopt Safari's device id only while this side has no groups of its own:
  // the server then recognises "you" in every group straight away. If the app
  // already made or joined groups under its own id, swapping would orphan
  // those — so it keeps its id, and the identity hints below (plus the
  // one-tap "Continue as …" on the join page) cover Safari's groups — and
  // Safari's id is linked, so groups joined there later still sync over.
  if (deviceId && UUID.test(deviceId)) {
    if (hadOwnGroups) linkDeviceId(deviceId)
    else setDeviceId(deviceId)
  }

  for (const t of trips) {
    if (t.identity && !localStorage.getItem(identityKey(t.id))) {
      localStorage.setItem(identityKey(t.id), t.identity)
    }
    if (t.creator) localStorage.setItem(creatorKey(t.id), 'true')
  }
  mergeRecentTrips(trips)
  return trips.filter((t) => !before.has(t.id)).length
}
