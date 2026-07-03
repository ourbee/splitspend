import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import { isSupabaseConfigured } from '../lib/supabase'
import CreateTripForm from '../components/CreateTripForm'

export default function HomePage() {
  const navigate = useNavigate()
  const createTrip = useTripStore((s) => s.createTrip)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCreate = async (name, currency, participants) => {
    setLoading(true)
    setError(null)
    try {
      const tripId = await createTrip(name, currency, participants)
      navigate(`/trip/${tripId}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Splitspend
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
          Split expenses, not friendships.
        </p>
      </div>

      {!isSupabaseConfigured() && (
        <div style={{
          background: 'var(--color-danger-light)',
          border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          marginBottom: 20,
          fontSize: 14,
        }}>
          <strong>Setup required:</strong> Add your Supabase credentials to the{' '}
          <code>.env</code> file. See <code>supabase-schema.sql</code> for the database schema.
        </div>
      )}

      <CreateTripForm onSubmit={handleCreate} loading={loading} />

      {error && (
        <p style={{ color: 'var(--color-danger)', textAlign: 'center', marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  )
}
