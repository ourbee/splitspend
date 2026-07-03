import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'
import useRealtime from '../hooks/useRealtime'
import { EMOJI_OPTIONS } from '../lib/emojis'

export default function JoinPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const claimIdentity = useTripStore((s) => s.claimIdentity)
  const fetchTrip = useTripStore((s) => s.fetchTrip)

  const [selectedId, setSelectedId] = useState(null)
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  useTrip(tripId)
  useRealtime(tripId)

  // Returning users with a recognized device skip this page entirely
  useEffect(() => {
    if (!loading && trip && myIdentity) {
      navigate(`/trip/${tripId}`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  const handleTap = (participant) => {
    setJoinError(null)
    if (selectedId === participant.id) {
      setSelectedId(null)
      setSelectedEmoji(null)
    } else {
      setSelectedId(participant.id)
      setSelectedEmoji(participant.emoji || EMOJI_OPTIONS[0])
    }
  }

  // First-time join of an unclaimed identity
  const handleJoin = async (participant) => {
    setJoining(true)
    setJoinError(null)
    try {
      const emoji = selectedEmoji && selectedEmoji !== participant.emoji ? selectedEmoji : null
      await claimIdentity(tripId, participant.id, { expectUnclaimed: true, emoji })
      navigate(`/trip/${tripId}`)
    } catch (err) {
      if (err.code === 'TAKEN') {
        setJoinError(`${participant.name} was just joined by someone else. If that's really you, tap "Continue as ${participant.name}" below.`)
        fetchTrip(tripId)
      } else {
        setJoinError(err.message)
      }
      setJoining(false)
      setSelectedId(null)
    }
  }

  // Welcome-back: this identity is claimed, register this device too
  const handleContinue = async (participant) => {
    setJoining(true)
    setJoinError(null)
    try {
      await claimIdentity(tripId, participant.id, { expectUnclaimed: false })
      navigate(`/trip/${tripId}`)
    } catch (err) {
      setJoinError(err.message)
      setJoining(false)
      setSelectedId(null)
    }
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
          <p style={{ fontSize: 20, marginBottom: 8 }}>Not found</p>
          <p>This link may be invalid or the data may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 60, paddingBottom: 40 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
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

      {joinError && (
        <p style={{
          color: 'var(--color-danger)',
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--color-danger-light)',
          borderRadius: 'var(--radius-md)',
        }}>
          {joinError}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {participants.map((p) => (
          <div key={p.id}>
            <button
              className="card"
              onClick={() => handleTap(p)}
              style={{
                border: selectedId === p.id
                  ? '2px solid var(--color-primary)'
                  : '2px solid var(--color-border)',
                background: selectedId === p.id
                  ? 'var(--color-primary-light)'
                  : 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: 18,
                fontWeight: 600,
                padding: '18px 20px',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                borderRadius: selectedId === p.id
                  ? 'var(--radius-md) var(--radius-md) 0 0'
                  : 'var(--radius-md)',
              }}
            >
              {p.emoji && <span style={{ fontSize: 24 }}>{p.emoji}</span>}
              <span>{p.name}</span>
              {p.claimed && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-success)',
                  background: 'var(--color-success-light)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}>
                  joined
                </span>
              )}
            </button>

            {selectedId === p.id && (
              <div style={{
                border: '2px solid var(--color-primary)',
                borderTop: 'none',
                borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                padding: 16,
                background: 'var(--color-surface)',
              }}>
                {p.claimed ? (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12, textAlign: 'center' }}>
                      Welcome back! {p.name} has already joined — if that's you
                      (maybe from another browser or after closing the link),
                      just continue.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleContinue(p)}
                      disabled={joining}
                      style={{ width: '100%' }}
                    >
                      {joining ? 'One moment...' : `Continue as ${p.emoji || ''} ${p.name}`}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10, textAlign: 'center' }}>
                      Pick your emoji
                    </p>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedEmoji(emoji)}
                          style={{
                            background: selectedEmoji === emoji ? 'var(--color-primary-light)' : 'none',
                            border: selectedEmoji === emoji
                              ? '2px solid var(--color-primary)'
                              : '2px solid transparent',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: 22,
                            padding: 5,
                            lineHeight: 1,
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleJoin(p)}
                      disabled={joining}
                      style={{ width: '100%' }}
                    >
                      {joining ? 'Joining...' : `Join as ${selectedEmoji || ''} ${p.name}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 24 }}>
        Names marked "joined" are already taken. Tap yours to continue where
        you left off — no login needed.
      </p>
    </div>
  )
}
