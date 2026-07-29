/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getDeviceId } from '../lib/deviceId'
import { broadcastRefresh } from '../lib/realtime'
import { rememberTrip } from '../lib/recentTrips'

// All reads and writes go through SECURITY DEFINER RPCs keyed by the trip
// UUID — the anon key has no direct table access (see supabase-schema.sql).

const identityKey = (tripId) => `splitspend_identity_${tripId}`

const useTripStore = create((set, get) => ({
  trip: null,
  participants: [],
  expenses: [],
  settlementRecords: [],
  myIdentity: null,
  loading: true,
  error: null,

  fetchTrip: async (tripId) => {
    if (!supabase) {
      set({ error: 'Supabase not configured', loading: false })
      return
    }
    // Only show the full-page spinner on first load, not on realtime refreshes
    if (get().trip?.id !== tripId) {
      set({ loading: true, error: null })
    }
    try {
      const { data, error } = await supabase.rpc('get_trip_data', {
        p_trip_id: tripId,
        p_device_id: getDeviceId(),
      })
      if (error) throw error
      if (!data) throw new Error('Not found')

      const participants = data.participants || []

      // Identity: the server's device match is authoritative; localStorage
      // is the fast path when it survives.
      let myIdentity = null
      const mine = participants.find((p) => p.is_me)
      if (mine) {
        myIdentity = mine.id
        localStorage.setItem(identityKey(tripId), mine.id)
      } else {
        const saved = localStorage.getItem(identityKey(tripId))
        if (saved && participants.some((p) => p.id === saved)) {
          myIdentity = saved
        } else {
          localStorage.removeItem(identityKey(tripId))
        }
      }

      rememberTrip(tripId, data.trip.name)

      set({
        trip: data.trip,
        participants,
        expenses: data.expenses || [],
        settlementRecords: data.settlement_records || [],
        myIdentity,
        loading: false,
        error: null,
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  createTrip: async (name, currency, participantData, creatorIndex) => {
    if (!supabase) throw new Error('Supabase not configured. Add your credentials to .env')

    const { data: tripId, error } = await supabase.rpc('create_trip_v4', {
      p_name: name,
      p_currency: currency,
      p_participants: participantData.map((p) => ({ name: p.name, emoji: p.emoji || '' })),
      p_creator_index: creatorIndex,
      p_device_id: getDeviceId(),
    })
    if (error) throw error

    localStorage.setItem(`splitspend_creator_${tripId}`, 'true')
    rememberTrip(tripId, name)

    await get().fetchTrip(tripId)
    return tripId
  },

  addExpense: async (tripId, description, amount, paidBy, splits, expenseDate) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('add_expense_v4', {
      p_trip_id: tripId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_splits: splits,
      p_created_by: get().myIdentity,
      p_expense_date: expenseDate || null,
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  updateExpense: async (expenseId, tripId, description, amount, paidBy, splits, expenseDate) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('update_expense_v4', {
      p_trip_id: tripId,
      p_expense_id: expenseId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_splits: splits,
      p_expense_date: expenseDate || null,
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  deleteExpense: async (expenseId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('delete_expense_v4', {
      p_trip_id: tripId,
      p_expense_id: expenseId,
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  recordSettlement: async (tripId, fromId, toId, amount) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('record_settlement_v4', {
      p_trip_id: tripId,
      p_from: fromId,
      p_to: toId,
      p_amount: amount,
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  undoSettlement: async (settlementId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('undo_settlement_v4', {
      p_trip_id: tripId,
      p_settlement_id: settlementId,
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  addParticipant: async (tripId, name, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase.rpc('add_participant_v4', {
      p_trip_id: tripId,
      p_name: name,
      p_emoji: emoji || '',
    })
    if (error) throw error

    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
    return data
  },

  // "Join as X" (expectUnclaimed: fails with error.code TAKEN if someone
  // else grabbed X first) or "Continue as X" welcome-back (expectUnclaimed
  // false: registers this device as another device of X).
  claimIdentity: async (tripId, participantId, { expectUnclaimed = false, emoji = null } = {}) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase.rpc('claim_identity_v4', {
      p_trip_id: tripId,
      p_participant_id: participantId,
      p_device_id: getDeviceId(),
      p_expect_unclaimed: expectUnclaimed,
      p_emoji: emoji,
    })
    if (error) throw error
    if (!data?.ok) {
      const err = new Error('This identity was just taken by someone else')
      err.code = 'TAKEN'
      throw err
    }

    localStorage.setItem(identityKey(tripId), participantId)
    set({ myIdentity: participantId })
    broadcastRefresh(tripId)
    await get().fetchTrip(tripId)
  },

  // Detach this device from its identity so the join page is shown again
  switchIdentity: async (tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const myIdentity = get().myIdentity
    if (myIdentity) {
      const { error } = await supabase.rpc('release_identity_v4', {
        p_trip_id: tripId,
        p_participant_id: myIdentity,
        p_device_id: getDeviceId(),
      })
      if (error) throw error
    }
    localStorage.removeItem(identityKey(tripId))
    set({ myIdentity: null })
    broadcastRefresh(tripId)
  },

  updateParticipantEmoji: async (tripId, participantId, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.rpc('update_participant_emoji_v4', {
      p_trip_id: tripId,
      p_participant_id: participantId,
      p_emoji: emoji,
    })
    if (error) throw error

    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, emoji } : p
      ),
    }))
    broadcastRefresh(tripId)
  },

  isCreator: () => {
    const { trip, myIdentity } = get()
    return trip?.creator_id === myIdentity
  },

  reset: () => {
    set({
      trip: null,
      participants: [],
      expenses: [],
      settlementRecords: [],
      myIdentity: null,
      loading: true,
      error: null,
    })
  },
}))

export default useTripStore
