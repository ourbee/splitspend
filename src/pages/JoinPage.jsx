import { useParams, useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'

export default function JoinPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const setIdentity = useTripStore((s) => s.setIdentity)

  useTrip(tripId)

  const handleSelect = (participantId) => {
    setIdentity(tripId, participantId)
    navigate(`/trip/${tripId}`)
  }

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="error-message">
          <p style={{ fontSize: 20, marginBottom: 8 }}>Trip not found</p>
          <p>This link may be invalid or the trip may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Splitspend
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {trip.name}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
          Who are you?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {participants.map((p) => (
          <button
            key={p.id}
            className="card"
            onClick={() => handleSelect(p.id)}
            style={{
              border: '2px solid var(--color-border)',
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 18,
              fontWeight: 600,
              padding: '20px',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'var(--color-primary)'
              e.target.style.background = 'var(--color-primary-light)'
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--color-border)'
              e.target.style.background = 'var(--color-surface)'
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}
