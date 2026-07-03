import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeTripChannel, unsubscribeTripChannel } from '../lib/realtime'
import useTripStore from '../store/tripStore'

export default function useRealtime(tripId) {
  const fetchTrip = useTripStore((s) => s.fetchTrip)

  useEffect(() => {
    if (!tripId || !supabase) return

    subscribeTripChannel(tripId, () => fetchTrip(tripId))

    // Broadcast events can be missed while the tab is backgrounded or the
    // connection drops — refetch whenever the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTrip(tripId)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribeTripChannel()
    }
  }, [tripId, fetchTrip])
}
