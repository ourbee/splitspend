import { useEffect } from 'react'
import useTripStore from '../store/tripStore'

export default function useTrip(tripId) {
  const fetchTrip = useTripStore((s) => s.fetchTrip)
  const currentTripId = useTripStore((s) => s.trip?.id)

  useEffect(() => {
    if (tripId && tripId !== currentTripId) {
      fetchTrip(tripId)
    }
  }, [tripId, currentTripId, fetchTrip])
}
