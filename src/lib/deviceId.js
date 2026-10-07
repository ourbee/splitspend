/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

const STORAGE_KEY = 'splitspend_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

// Used only by the Safari → Home Screen handoff, so both sides of an iPhone
// present the same device to the server.
export function setDeviceId(id) {
  localStorage.setItem(STORAGE_KEY, id)
}

// Other device ids that are also "this person on this phone" — on iPhone,
// Safari's id, linked by the handoff when the Home Screen app already had an
// id of its own. Server-side group sync reads all of them.
const LINKED_KEY = 'splitspend_linked_devices'

export function getLinkedDeviceIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(LINKED_KEY))
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function linkDeviceId(id) {
  const ids = getLinkedDeviceIds()
  if (!id || id === getDeviceId() || ids.includes(id)) return
  localStorage.setItem(LINKED_KEY, JSON.stringify([...ids, id].slice(-7)))
}
