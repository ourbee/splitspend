import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  const trip = useTripStore((s) => s.trip)
  const myIdentity = useTripStore((s) => s.myIdentity)
  const loading = useTripStore((s) => s.loading)
  const error = useTripStore((s) => s.error)
  const isCreator = useTripStore((s) => s.isCreator)

  const [activeTab, setActiveTab] = useState('expenses')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useTrip(tripId)
  useRealtime(tripId)

  // Redirect to join page if no identity set
  useEffect(() => {
    if (!loading && trip && !myIdentity) {
      navigate(`/trip/${tripId}/join`, { replace: true })
    }
  }, [loading, trip, myIdentity, tripId, navigate])

  // Show QR on first visit (when coming from trip creation)
  useEffect(() => {
    const shown = sessionStorage.getItem(`splitspend_qr_shown_${tripId}`)
    if (!loading && trip && myIdentity && !shown) {
      setShowQR(true)
      sessionStorage.setItem(`splitspend_qr_shown_${tripId}`, '1')
    }
  }, [loading, trip, myIdentity, tripId])

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
          <p style={{ fontSize: 20, marginBottom: 8 }}>Trip not found</p>
          <p>This link may be invalid or the trip may have been deleted.</p>
        </div>
      </div>
    )
  }

  const creator = isCreator()

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
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{trip.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 14 }}
            onClick={() => setShowQR(true)}
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
      {activeTab === 'expenses' && <ExpenseList />}
      {activeTab === 'balances' && <BalanceSummary />}
      {activeTab === 'settle' && <SettlementList />}

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddExpense(true)}>
        +
      </button>

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} />
      )}
      {showQR && (
        <QRCodeDisplay tripId={tripId} onClose={() => setShowQR(false)} />
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
