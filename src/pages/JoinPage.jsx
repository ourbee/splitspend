import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'
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
  const updateParticipantEmoji = useTripStore((s) => s.updateParticipantEmoji)

  const [selectedId, setSelectedId] = useState(null)
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [joining, setJoining] = useState(false)

  useTrip(tripId)

  // Redirect returning users who already have an identity
  useEffect(() => {
    if (!loading && trip && myIdentity) {
      navigate(`/trip/${tripId}`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  // Filter out already-claimed participants
  const unclaimedParticipants = participants.filter((p) => !p.claimed_by)
  const claimedParticipants = participants.filter((p) => p.claimed_by)

  const handleTap = (participant) => {
    if (selectedId === participant.id) {
      setSelectedId(null)
      setSelectedEmoji(null)
    } else {
      setSelectedId(participant.id)
      setSelectedEmoji(participant.emoji || EMOJI_OPTIONS[0])
    }
  }

  const handleConfirm = async () => {
    if (!selectedId) return
    setJoining(true)
    try {
      const participant = participants.find(p => p.id === selectedId)
      if (selectedEmoji && selectedEmoji !== participant?.emoji) {
        await updateParticipantEmoji(selectedId, selectedEmoji)
      }
      await claimIdentity(tripId, selectedId)
      navigate(`/trip/${tripId}`)
    } catch {
      setJoining(false)
    }
  }

  const handleRejoin = async (participant) => {
    setJoining(true)
    try {
      await claimIdentity(tripId, participant.id)
      navigate(`/trip/${tripId}`)
    } catch {
      setJoining(false)
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
        {unclaimedParticipants.length === 0 && claimedParticipants.length > 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 18, marginBottom: 8 }}>All identities have been claimed</p>
            <p>If you were already part of this group, tap your name below to rejoin.</p>
          </div>
        ) : (
          unclaimedParticipants.map((p) => (
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
                  padding: '20px',
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
                {p.name}
              </button>

              {selectedId === p.id && (
                <div style={{
                  border: '2px solid var(--color-primary)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  padding: 16,
                  background: 'var(--color-surface)',
                }}>
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
                    onClick={handleConfirm}
                    disabled={joining}
                    style={{ width: '100%' }}
                  >
                    {joining ? 'Joining...' : `Join as ${selectedEmoji || ''} ${p.name}`}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Show claimed participants with rejoin option */}
      {claimedParticipants.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, textAlign: 'center' }}>
            Already joined:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {claimedParticipants.map(p => (
              <div
                key={p.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  opacity: 0.8,
                }}
              >
                <span style={{ fontSize: 15 }}>
                  {p.emoji && <span style={{ marginRight: 6 }}>{p.emoji}</span>}
                  {p.name}
                </span>
                <button
                  className="btn-ghost"
                  onClick={() => handleRejoin(p)}
                  disabled={joining}
                  style={{
                    fontSize: 13,
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    padding: '4px 10px',
                  }}
                >
                  This is me
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
