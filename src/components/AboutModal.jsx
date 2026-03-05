export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>About</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Splitspend
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Split expenses, not friendships.
          </p>
        </div>

        <div style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          marginBottom: 16,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          <p style={{ marginBottom: 8 }}>
            No accounts. No logins. Just share a link and split expenses with friends.
          </p>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your data lives as long as the link does. Export anytime to keep a local copy.
          </p>
        </div>

        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Created by <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Ritwik Balo</span>
        </p>
      </div>
    </div>
  )
}
