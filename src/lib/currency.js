/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
  { code: 'AED', symbol: 'AED ', label: 'AED (dirham)' },
  { code: 'THB', symbol: '฿', label: 'THB (฿)' },
  { code: 'CHF', symbol: 'CHF ', label: 'CHF (franc)' },
  { code: 'LKR', symbol: 'Rs ', label: 'LKR (Rs)' },
  { code: 'NPR', symbol: 'Rs ', label: 'NPR (Rs)' },
  { code: 'IDR', symbol: 'Rp ', label: 'IDR (Rp)' },
  { code: 'VND', symbol: '₫', label: 'VND (₫)' },
]

export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || (code ? `${code} ` : '')
}
