/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// "Your Splitspends" from the server: every group this device (and any
// device linked to it) has joined. This is what keeps Safari and the iPhone
// Home Screen app in step after the one-time handoff — see lib/handoff.js.

import { supabase } from './supabase'
import { getDeviceId, getLinkedDeviceIds } from './deviceId'
import { syncRecentTrips } from './recentTrips'

const identityKey = (tripId) => `splitspend_identity_${tripId}`

// Resolves true when the local list changed. Never throws: before the v10
// migration the RPC does not exist, and the local list is still correct.
export async function syncMyTrips() {
  if (!supabase) return false
  try {
    const { data, error } = await supabase.rpc('list_device_trips_v10', {
      p_device_ids: [getDeviceId(), ...getLinkedDeviceIds()],
    })
    if (error || !Array.isArray(data)) return false
    const rows = data.map((r) => ({
      id: r.id,
      name: r.name,
      at: Date.parse(r.joined_at) || Date.now(),
    }))
    // Identity hints, so a group joined on a linked device opens straight
    // into the group instead of the Join page.
    for (const r of data) {
      if (r.participant_id && !localStorage.getItem(identityKey(r.id))) {
        localStorage.setItem(identityKey(r.id), r.participant_id)
      }
    }
    return syncRecentTrips(rows)
  } catch {
    return false
  }
}
