/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildHandoff, parsePasted, applyHandoff } from '../lib/handoff'

const muted = { fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }

// Safari side: copy this device's list so the Home Screen app can paste it.
export function CopyForApp() {
  const [status, setStatus] = useState(null)

  const copy = async () => {
    const link = buildHandoff()
    try {
      await navigator.clipboard.writeText(link)
      setStatus('copied')
    } catch {
      // Older Safari without async clipboard: show the link to copy by hand.
      setStatus(link)
    }
  }

  return (
    <div style={{ marginTop: 20, textAlign: 'center' }}>
      <p style={muted}>
        Added Splitspend to your Home Screen? That app keeps its own list.
      </p>
      <button type="button" className="btn btn-secondary" onClick={copy} style={{ marginTop: 8 }}>
        Copy list for the Home Screen app
      </button>
      {status === 'copied' && (
        <p style={{ ...muted, marginTop: 8, color: 'var(--color-text)' }}>
          Copied. Now open Splitspend from your Home Screen and tap <strong>Paste from Safari</strong>.
        </p>
      )}
      {status && status !== 'copied' && (
        <textarea
          readOnly
          value={status}
          onFocus={(e) => e.target.select()}
          className="input"
          rows={3}
          style={{ marginTop: 8, width: '100%', fontSize: 12 }}
        />
      )}
    </div>
  )
}

// Home Screen side: paste Safari's list, or any Splitspend group link.
export function PasteFromSafari({ hasGroups, onImported }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(!hasGroups)
  const [manual, setManual] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState(null)

  const use = (pasted) => {
    const parsed = parsePasted(pasted)
    if (!parsed) {
      setMessage("That isn't a Splitspend link. In Safari, tap \"Copy list for the Home Screen app\" first.")
      setManual(true)
      return
    }
    if (parsed.kind === 'trip') {
      navigate(`/trip/${parsed.tripId}`)
      return
    }
    const added = applyHandoff(parsed)
    setMessage(added > 0
      ? `Added ${added} Splitspend${added === 1 ? '' : 's'} from Safari.`
      : 'Already up to date — nothing new from Safari.')
    setManual(false)
    setText('')
    onImported()
  }

  const paste = async () => {
    setMessage(null)
    try {
      use(await navigator.clipboard.readText())
    } catch {
      setManual(true)
    }
  }

  if (!open) {
    return (
      <p style={{ ...muted, textAlign: 'center', marginTop: 16 }}>
        Missing some from Safari?{' '}
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-primary)', fontWeight: 600, fontSize: 13 }}
        >
          Bring them in
        </button>
      </p>
    )
  }

  return (
    <div className="card" style={{ marginTop: 24, padding: 16 }}>
      <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Bring in your Splitspends</p>
      <p style={muted}>
        The Home Screen app can't see what Safari has saved. In Safari, open{' '}
        <strong>splitspend.vercel.app</strong> and tap <strong>Copy list for the Home Screen app</strong>,
        then come back here. A group link from WhatsApp works too.
      </p>
      <button type="button" className="btn btn-primary" onClick={paste} style={{ marginTop: 12, width: '100%' }}>
        Paste from Safari
      </button>
      {manual && (
        <div style={{ marginTop: 10 }}>
          <textarea
            className="input"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the link here"
            style={{ width: '100%', fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => use(text)}
            disabled={!text.trim()}
            style={{ marginTop: 8, width: '100%' }}
          >
            Use this link
          </button>
        </div>
      )}
      {message && <p style={{ ...muted, marginTop: 10, color: 'var(--color-text)' }}>{message}</p>}
    </div>
  )
}
