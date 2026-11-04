export function formatMoney(cents: number): string {
  const yuan = cents / 100
  if (Number.isInteger(yuan)) return String(yuan)
  return yuan.toFixed(2).replace(/0$/, '')
}

export function formatPrice(cents: number): string {
  return `¥${formatMoney(cents)}`
}

export function formatDelta(cents: number): string {
  if (!cents) return ''
  const sign = cents > 0 ? '+' : '-'
  return `${sign}¥${formatMoney(Math.abs(cents))}`
}
