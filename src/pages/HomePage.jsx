/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { getRecentTrips } from '../lib/recentTrips'
import CreateTripForm from '../components/CreateTripForm'

export default function HomePage() {
  const navigate = useNavigate()
  const createTrip = useTripStore((s) => s.createTrip)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recent] = useState(getRecentTrips)

  const handleCreate = async (name, currency, participants, creatorIndex) => {
    setLoading(true)
    setError(null)
    try {
      const tripId = await createTrip(name, currency, participants, creatorIndex)
      navigate(`/trip/${tripId}`)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img
          src="/favicon.svg"
          alt="Splitspend"
          style={{ width: 56, height: 56, marginBottom: 12, borderRadius: 12 }}
        />
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

      {recent.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            Your Splitspends on this device
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map((t) => (
              <Link
                key={t.id}
                to={`/trip/${t.id}`}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  textDecoration: 'none',
                  color: 'var(--color-text)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
