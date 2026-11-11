export const APP_TIME_ZONE = 'Asia/Shanghai';

export interface BusinessHour {
  day: number;
  open: string;
  close: string;
}

export interface ZonedNow {
  day: number;
  minutes: number;
  date: string;
}

export interface BusinessHoursState {
  isWithinHours: boolean;
  todayHours: BusinessHour | null;
}

export interface ShanghaiDayRange {
  date: string;
  start: Date;
  end: Date;
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function getZonedNow(now = new Date()): ZonedNow {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  return {
    day: WEEKDAY_TO_ISO[parts.weekday ?? ''] ?? 0,
    minutes: hour * 60 + minute,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * 把 YYYY-MM-DD 解析成上海时区当天 [start, end)。
 * 不传 date 时取上海今天；非法日期直接抛 RangeError，由调用方转成 400。
 */
export function getShanghaiDayRange(date?: string): ShanghaiDayRange {
  const target = date ?? getZonedNow().date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    throw new RangeError(`Invalid date: ${target}`);
  }

  const start = new Date(`${target}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime()) || getZonedNow(start).date !== target) {
    throw new RangeError(`Invalid date: ${target}`);
  }

  return {
    date: target,
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 把数据库里的 business_hours JSON 收敛成安全的结构。
 * 非法项直接丢弃，避免一个坏配置让整个门店接口 500。
 */
export function parseBusinessHours(value: unknown): BusinessHour[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: BusinessHour[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const day = item.day;
    const { open, close } = item;

    if (
      typeof day !== 'number' ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 7 ||
      typeof open !== 'string' ||
      typeof close !== 'string' ||
      !HHMM.test(open) ||
      !HHMM.test(close)
    ) {
      continue;
    }

    result.push({ day, open, close });
  }

  return result;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function getBusinessHoursState(
  hours: BusinessHour[],
  now = new Date(),
): BusinessHoursState {
  const zoned = getZonedNow(now);
  const todayHours = hours.find((entry) => entry.day === zoned.day) ?? null;

  if (!todayHours) {
    return { isWithinHours: false, todayHours: null };
  }

  const openMinutes = toMinutes(todayHours.open);
  const closeMinutes = toMinutes(todayHours.close);

  // P0 不支持跨天营业；open === close 视为休息。
  return {
    isWithinHours:
      openMinutes < closeMinutes &&
      zoned.minutes >= openMinutes &&
      zoned.minutes < closeMinutes,
    todayHours,
  };
}
