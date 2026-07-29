/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

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
