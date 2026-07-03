import { useState } from 'react'
import useTripStore from '../store/tripStore'
import ExpenseCard from './ExpenseCard'
import ConfirmDialog from './ConfirmDialog'

export default function ExpenseList({ onEdit }) {
  const expenses = useTripStore((s) => s.expenses)
  const trip = useTripStore((s) => s.trip)
  const deleteExpense = useTripStore((s) => s.deleteExpense)

  const [confirmingId, setConfirmingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteExpense(confirmingId, trip.id)
      setConfirmingId(null)
    } catch (err) {
      setError('Failed to delete: ' + err.message)
    }
    setBusy(false)
  }

  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 36, marginBottom: 8 }}>No expenses yet</p>
        <p>Tap + to add your first expense</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {expenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          onDelete={(id) => { setError(null); setConfirmingId(id) }}
          onEdit={onEdit}
        />
      ))}

      {confirmingId && (
        <ConfirmDialog
          title="Delete this expense?"
          message="This removes it for everyone in the group."
          confirmLabel="Delete"
          danger
          busy={busy}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingId(null)}
        />
      )}
    </div>
  )
}
