import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function QRCodeDisplay({ tripId, onClose }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/trip/${tripId}/join`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareLink = async () => {
    try {
      await navigator.share({ url, title: 'Join my Splitspend trip' })
    } catch {
      // Share cancelled or not supported
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Share Trip</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }}>&times;</button>
        </div>

        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
          Others can scan this QR code to join and view expenses
        </p>

        <div style={{
          display: 'inline-block',
          padding: 16,
          background: 'white',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
        }}>
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <p style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          wordBreak: 'break-all',
          marginBottom: 20,
          padding: '8px 12px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-sm)',
        }}>
          {url}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button className="btn btn-secondary" onClick={shareLink}>
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
