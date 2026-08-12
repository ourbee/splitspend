/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import useTripStore from '../store/tripStore'
import useTrip from '../hooks/useTrip'
import useRealtime from '../hooks/useRealtime'
import ExpenseList from '../components/ExpenseList'
import BalanceSummary from '../components/BalanceSummary'
import SettlementList from '../components/SettlementList'
import AddExpenseModal from '../components/AddExpenseModal'
import AddParticipantModal from '../components/AddParticipantModal'
import QRCodeDisplay from '../components/QRCodeDisplay'
import ExportModal from '../components/ExportModal'
import AboutModal from '../components/AboutModal'

export default function TripPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const trip = useTripStore((s) => s.trip)
  const participants = useTripStore((s) => s.participants)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const isCreator = useTripStore((s) => s.isCreator)
  const switchIdentity = useTripStore((s) => s.switchIdentity)

  const [activeTab, setActiveTab] = useState('expenses')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [showQRManual, setShowQRManual] = useState(false)
  // Auto-open the share sheet only for the person who just created this
  // Splitspend. Everyone else — and the creator on every later visit — gets
  // it from the Share button.
  const [showQRAuto, setShowQRAuto] = useState(() => !!location.state?.justCreated)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useTrip(tripId)
  useRealtime(tripId)

  // Drop the flag from history straight away, so reloading the page (which
  // restores history state) doesn't bring the share sheet back.
  useEffect(() => {
    if (location.state?.justCreated) {
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect to join page if no identity set
  useEffect(() => {
    if (!loading && trip && !myIdentity) {
      navigate(`/trip/${tripId}/join`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    const handler = () => setShowMenu(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showMenu])

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

  const creator = isCreator()
  const me = participants.find((p) => p.id === myIdentity)

  const showQR = showQRManual || (showQRAuto && !!myIdentity)

  const handleCloseQR = () => {
    setShowQRAuto(false)
    setShowQRManual(false)
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
  }

  const handleCloseExpenseModal = () => {
    setShowAddExpense(false)
    setEditingExpense(null)
  }

  const handleSwitchIdentity = async () => {
    setShowMenu(false)
    try {
      await switchIdentity(tripId)
      navigate(`/trip/${tripId}/join`)
    } catch {
      // stay on page; next fetch re-syncs state
    }
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '8px 0',
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{trip.name}</h1>
          {me && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              You are {me.emoji || ''} {me.name}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 14 }}
            onClick={() => setShowQRManual(true)}
          >
            Share
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn-ghost"
              style={{ fontSize: 22, padding: '4px 8px', lineHeight: 1 }}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              title="More options"
            >
              &#8942;
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-modal)',
                zIndex: 60,
                minWidth: 180,
                overflow: 'hidden',
              }}>
                <button
                  className="menu-item"
                  onClick={() => { window.open(window.location.origin, '_blank'); setShowMenu(false) }}
                >
                  New Splitspend
                </button>
                {creator && (
                  <button
                    className="menu-item"
                    onClick={() => { setShowAddParticipant(true); setShowMenu(false) }}
                  >
                    Add Participant
                  </button>
                )}
                <button
                  className="menu-item"
                  onClick={handleSwitchIdentity}
                >
                  Not you? Switch identity
                </button>
                <button
                  className="menu-item"
                  onClick={() => { setShowExport(true); setShowMenu(false) }}
                >
                  Export Data
                </button>
                <button
                  className="menu-item"
                  onClick={() => { setShowAbout(true); setShowMenu(false) }}
                >
                  About Splitspend
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button
          className={`tab ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Balances
        </button>
        <button
          className={`tab ${activeTab === 'settle' ? 'active' : ''}`}
          onClick={() => setActiveTab('settle')}
        >
          Settle
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'expenses' && <ExpenseList onEdit={handleEdit} />}
      {activeTab === 'balances' && <BalanceSummary />}
      {activeTab === 'settle' && <SettlementList />}

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddExpense(true)}>
        +
      </button>

      {/* Modals */}
      {(showAddExpense || editingExpense) && (
        <AddExpenseModal
          onClose={handleCloseExpenseModal}
          expense={editingExpense}
        />
      )}
      {showQR && (
        <QRCodeDisplay tripId={tripId} onClose={handleCloseQR} />
      )}
      {showAddParticipant && (
        <AddParticipantModal onClose={() => setShowAddParticipant(false)} />
      )}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  )
}
