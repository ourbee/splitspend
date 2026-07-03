import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
    set({ loading: true, error: null })
    try {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      if (tripError) throw tripError

      const { data: participants, error: partError } = await supabase
        .from('participants')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at')

      if (partError) throw partError

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('*, splits:expense_splits(*)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })

      if (expError) throw expError

      const { data: settlementRecords, error: settleError } = await supabase
        .from('settlement_records')
        .select('*')
        .eq('trip_id', tripId)
        .order('settled_at', { ascending: false })

      if (settleError) throw settleError

      // Load identity from localStorage
      const savedIdentity = localStorage.getItem(`splitspend_identity_${tripId}`)

      set({
        trip,
        participants,
        expenses,
        settlementRecords: settlementRecords || [],
        myIdentity: savedIdentity,
        loading: false,
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  createTrip: async (name, currency, participantData, creatorIndex) => {
    if (!supabase) throw new Error('Supabase not configured. Add your credentials to .env')

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({ name, currency })
      .select()
      .single()

    if (tripError) throw tripError

    const participantRows = participantData.map((p) => ({
      trip_id: trip.id,
      name: p.name,
      emoji: p.emoji || '',
    }))

    const { data: participants, error: partError } = await supabase
      .from('participants')
      .insert(participantRows)
      .select()

    if (partError) throw partError

    // Set the creator
    const creatorId = participants[creatorIndex]?.id || participants[0].id

    // Mark creator as claimed
    await supabase
      .from('participants')
      .update({ claimed_by: creatorId })
      .eq('id', creatorId)

    // Update trip with creator_id
    await supabase
      .from('trips')
      .update({ creator_id: creatorId })
      .eq('id', trip.id)

    localStorage.setItem(`splitspend_identity_${trip.id}`, creatorId)
    localStorage.setItem(`splitspend_creator_${trip.id}`, 'true')

    set({
      trip: { ...trip, creator_id: creatorId },
      participants: participants.map(p =>
        p.id === creatorId ? { ...p, claimed_by: creatorId } : p
      ),
      expenses: [],
      settlementRecords: [],
      myIdentity: creatorId,
      loading: false,
    })
    return trip.id
  },

  addExpense: async (tripId, description, amount, paidBy, splitAmong) => {
    if (!supabase) throw new Error('Supabase not configured')

    const shareAmount = Math.floor((amount * 100) / splitAmong.length) / 100
    const remainder = Math.round((amount - shareAmount * splitAmong.length) * 100) / 100

    const splits = splitAmong.map((participantId, idx) => ({
      participant_id: participantId,
      share_amount: idx === 0 ? shareAmount + remainder : shareAmount,
    }))

    const { data: expenseId, error } = await supabase.rpc('add_expense', {
      p_trip_id: tripId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_splits: splits,
    })

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  deleteExpense: async (expenseId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  recordSettlement: async (tripId, fromId, toId, amount) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('settlement_records')
      .insert({
        trip_id: tripId,
        from_participant: fromId,
        to_participant: toId,
        amount,
      })

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  undoSettlement: async (settlementId, tripId) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('settlement_records')
      .delete()
      .eq('id', settlementId)

    if (error) throw error
    await get().fetchTrip(tripId)
  },

  addParticipant: async (tripId, name, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase
      .from('participants')
      .insert({ trip_id: tripId, name, emoji: emoji || '' })
      .select()
      .single()

    if (error) throw error
    await get().fetchTrip(tripId)
    return data
  },

  claimIdentity: async (tripId, participantId) => {
    if (!supabase) throw new Error('Supabase not configured')

    await supabase
      .from('participants')
      .update({ claimed_by: participantId })
      .eq('id', participantId)

    localStorage.setItem(`splitspend_identity_${tripId}`, participantId)
    set({ myIdentity: participantId })
  },

  updateParticipantEmoji: async (participantId, emoji) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase
      .from('participants')
      .update({ emoji })
      .eq('id', participantId)

    if (error) throw error

    set((state) => ({
      participants: state.participants.map(p =>
        p.id === participantId ? { ...p, emoji } : p
      ),
    }))
  },

  setIdentity: (tripId, participantId) => {
    localStorage.setItem(`splitspend_identity_${tripId}`, participantId)
    set({ myIdentity: participantId })
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
