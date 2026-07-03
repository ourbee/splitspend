import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const useTripStore = create((set, get) => ({
  trip: null,
  participants: [],
  expenses: [],
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

      // Load identity from localStorage
      const savedIdentity = localStorage.getItem(`splitspend_identity_${tripId}`)

      set({
        trip,
        participants,
        expenses,
        myIdentity: savedIdentity,
        loading: false,
      })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  createTrip: async (name, currency, participantNames) => {
    if (!supabase) throw new Error('Supabase not configured. Add your credentials to .env')

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({ name, currency })
      .select()
      .single()

    if (tripError) throw tripError

    const participantRows = participantNames.map((pName) => ({
      trip_id: trip.id,
      name: pName,
    }))

    const { data: participants, error: partError } = await supabase
      .from('participants')
      .insert(participantRows)
      .select()

    if (partError) throw partError

    // Auto-set creator as the first participant
    const creatorId = participants[0].id
    localStorage.setItem(`splitspend_identity_${trip.id}`, creatorId)

    set({ trip, participants, expenses: [], myIdentity: creatorId, loading: false })
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

    // Refetch expenses to get full data with splits
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

  setIdentity: (tripId, participantId) => {
    localStorage.setItem(`splitspend_identity_${tripId}`, participantId)
    set({ myIdentity: participantId })
  },

  reset: () => {
    set({
      trip: null,
      participants: [],
      expenses: [],
      myIdentity: null,
      loading: true,
      error: null,
    })
  },
}))

export default useTripStore
