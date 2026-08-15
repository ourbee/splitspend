/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

// The credit line that runs along the bottom of every page of an exported
// diary, in both the printable page and the Word document.
//
// Note what is here and what deliberately is not: the app's own address and
// its author, never the trip's address. A trip link is a capability — anyone
// holding it can open and edit the group — and a printed page is exactly the
// kind of thing that gets left on a table. v7 stripped URLs from the diary
// wholesale for that reason; this is the narrow, intended way they come back.

export const APP_URL = 'splitspend.vercel.app'
export const AUTHOR = 'Ritwik Balo'
export const AUTHOR_URL = 'github.com/ourbee'

/** Plain text, for the Word footer and anywhere markup isn't available. */
export const FOOTER_TEXT = `${APP_URL} · Created by ${AUTHOR} · ${AUTHOR_URL}`

/** The same line with both addresses live. */
export const FOOTER_HTML =
  `<a href="https://${APP_URL}">${APP_URL}</a>` +
  ` &middot; Created by ${AUTHOR} &middot; ` +
  `<a href="https://${AUTHOR_URL}">${AUTHOR_URL}</a>`
