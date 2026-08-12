/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

/**
 * Shared emoji sheet. Used both for an expense's icon (grouped, with an
 * "Auto" escape back to the description-based guess) and for a person's
 * avatar (one flat group).
 */
export default function EmojiPicker({
  title,
  groups,
  value,
  onPick,
  onClose,
  autoLabel,
  autoPreview,
  onPickAuto,
  disabled = [],
}) {
  const disabledSet = new Set(disabled)

  return (
    // Rendered inside another modal, so the backdrop click must not bubble up
    // and close the expense sheet behind it.
    <div
      className="modal-overlay"
      style={{ zIndex: 120 }}
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: 22 }} aria-label="Close">
            &times;
          </button>
        </div>

        {onPickAuto && (
          <button
            type="button"
            className={`emoji-auto ${value == null ? 'selected' : ''}`}
            onClick={() => { onPickAuto(); onClose() }}
          >
            <span style={{ fontSize: 22 }} aria-hidden="true">{autoPreview}</span>
            <span>
              <strong>{autoLabel}</strong>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Follows what you type in the description
              </span>
            </span>
          </button>
        )}

        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: 14 }}>
            {group.label && <div className="emoji-group-label">{group.label}</div>}
            <div className="emoji-grid">
              {group.emojis.map((emoji) => {
                const isDisabled = disabledSet.has(emoji)
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`emoji-option ${value === emoji ? 'selected' : ''}`}
                    disabled={isDisabled}
                    title={isDisabled ? 'Already taken' : undefined}
                    onClick={() => { onPick(emoji); onClose() }}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
