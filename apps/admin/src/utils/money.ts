export function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export function formatDelta(cents: number): string {
  if (cents === 0) {
    return '不加价'
  }
  return `${cents > 0 ? '+' : '-'}${formatCents(Math.abs(cents))}`
}

export function centsToYuan(cents: number): number {
  return cents / 100
}

export function yuanToCents(yuan: number | string): number {
  const value = Number(yuan)
  if (!Number.isFinite(value)) {
    return Number.NaN
  }
  return Math.round(value * 100)
}
