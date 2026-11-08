export const SHANGHAI_OFFSET_MINUTES = 8 * 60

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Format an absolute instant as Asia/Shanghai HH:mm without relying on Intl. */
export function formatShanghaiTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '--:--'
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + SHANGHAI_OFFSET_MINUTES
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

export function formatShanghaiDateTime(value: string | Date | null): string {
  if (!value) return '--'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '--'
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MINUTES * 60_000)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

export interface PickupSlot {
  iso: string
  label: string
}

/** Next eight 15-minute slots, starting at least 15 minutes from now. */
export function buildPickupSlots(now = new Date()): PickupSlot[] {
  const step = 15 * 60_000
  const start = Math.ceil((now.getTime() + 15 * 60_000) / step) * step
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(start + index * step)
    return { iso: date.toISOString(), label: formatShanghaiTime(date) }
  })
}
