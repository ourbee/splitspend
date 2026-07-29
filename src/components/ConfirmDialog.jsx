/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// In-UI confirmation dialog (window.confirm/alert are suppressed in some
// in-app browsers, which is exactly where Splitspend users live).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }} onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 'var(--radius-lg)', maxWidth: 340, margin: '0 16px' }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        {message && (
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            {message}
          </p>
        )}
        {error && (
          <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 12 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
