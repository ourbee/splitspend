/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { supabase } from './supabase'

// One Broadcast channel per open trip. Clients that write also broadcast a
// 'refresh' event so everyone else refetches. Unlike postgres_changes, this
// needs no table replication and no table read access for the anon key.
let channel = null
let channelTripId = null

export function subscribeTripChannel(tripId, onRefresh) {
  if (!supabase) return
  unsubscribeTripChannel()
  channel = supabase.channel(`trip-${tripId}`, {
    config: { broadcast: { self: false } },
  })
  channel.on('broadcast', { event: 'refresh' }, onRefresh).subscribe()
  channelTripId = tripId
}

export function unsubscribeTripChannel() {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
  channel = null
  channelTripId = null
}

export function broadcastRefresh(tripId) {
  if (channel && channelTripId === tripId) {
    channel.send({ type: 'broadcast', event: 'refresh', payload: {} })
  }
}
