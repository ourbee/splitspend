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
