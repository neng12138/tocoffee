import { getZonedNow } from '../../../common/utils/time.js';

const CLOSING_MINUTES = 23 * 60 + 59;

export function toUtcBusinessDate(value: Date): Date {
  const { date } = getZonedNow(value);
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isClosingTime(now: Date): boolean {
  return getZonedNow(now).minutes >= CLOSING_MINUTES;
}
