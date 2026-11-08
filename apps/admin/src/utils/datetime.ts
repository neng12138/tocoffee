const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function parts(value: string | Date) {
  const map: Record<string, string> = {}
  for (const part of DATE_TIME_FORMATTER.formatToParts(new Date(value))) {
    if (part.type !== 'literal') {
      map[part.type] = part.value
    }
  }
  return map
}

export function formatDateTime(value: string | Date | null): string {
  if (!value) return '—'
  const p = parts(value)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

export function formatClock(value: string | Date | null): string {
  if (!value) return '—'
  return TIME_FORMATTER.format(new Date(value))
}

export function todayShanghai(): string {
  const p = parts(new Date())
  return `${p.year}-${p.month}-${p.day}`
}
