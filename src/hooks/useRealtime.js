import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useTripStore from '../store/tripStore'

export default function useRealtime(tripId) {
  const fetchTrip = useTripStore((s) => s.fetchTrip)

  useEffect(() => {
    if (!tripId || !supabase) return

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlement_records', filter: `trip_id=eq.${tripId}` },
        () => fetchTrip(tripId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, fetchTrip])
}
