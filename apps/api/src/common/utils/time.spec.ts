import { describe, expect, it } from 'vitest';
import {
  getBusinessHoursState,
  getZonedNow,
  parseBusinessHours,
} from './time.js';

const ALL_WEEK = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  open: '08:00',
  close: '20:00',
}));

describe('time utils', () => {
  it('converts UTC to Asia/Shanghai date, weekday and minutes', () => {
    const zoned = getZonedNow(new Date('2026-11-04T02:00:00.000Z'));

    expect(zoned).toEqual({
      day: 3,
      minutes: 10 * 60,
      date: '2026-11-04',
    });
  });

  it('is open at 10:00 and closed at 21:00 Shanghai time', () => {
    expect(
      getBusinessHoursState(
        ALL_WEEK,
        new Date('2026-11-04T02:00:00.000Z'),
      ).isWithinHours,
    ).toBe(true);

    expect(
      getBusinessHoursState(
        ALL_WEEK,
        new Date('2026-11-04T13:00:00.000Z'),
      ).isWithinHours,
    ).toBe(false);
  });

  it('drops malformed business hour entries', () => {
    const parsed = parseBusinessHours([
      { day: 1, open: '08:00', close: '20:00' },
      { day: 9, open: '08:00', close: '20:00' },
      { day: 2, open: '8:00', close: '20:00' },
      { day: '3', open: '08:00', close: '20:00' },
      null,
    ]);

    expect(parsed).toEqual([{ day: 1, open: '08:00', close: '20:00' }]);
  });

  it('does not treat an overnight range as open (P0 unsupported)', () => {
    const state = getBusinessHoursState(
      [{ day: 3, open: '22:00', close: '02:00' }],
      new Date('2026-11-04T15:00:00.000Z'),
    );

    expect(state.isWithinHours).toBe(false);
  });
});
