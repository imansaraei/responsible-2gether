// @vitest-environment node
import { isValidTimeZone, reminderDue } from './schedule';

const at = (iso: string) => new Date(iso);

describe('reminderDue', () => {
  test.each([
    // London in summer time (UTC+1)
    ['2026-07-01T09:00:00Z', 'Europe/London', 'morning'],
    ['2026-07-01T09:14:59Z', 'Europe/London', 'morning'],
    ['2026-07-01T09:15:00Z', 'Europe/London', null],
    ['2026-07-01T21:05:00Z', 'Europe/London', 'evening'],
    // London in winter (UTC+0)
    ['2026-12-01T10:00:00Z', 'Europe/London', 'morning'],
    ['2026-12-01T09:00:00Z', 'Europe/London', null],
    // Tehran is UTC+3:30, so 10:00 local is 06:30 UTC
    ['2026-10-13T06:30:00Z', 'Asia/Tehran', 'morning'],
    ['2026-10-13T06:00:00Z', 'Asia/Tehran', null],
    ['2026-10-13T18:30:00Z', 'Asia/Tehran', 'evening'],
    // Other hours never fire
    ['2026-10-13T12:00:00Z', 'UTC', null],
  ])('%s in %s → %s', (iso, tz, expected) => {
    expect(reminderDue(at(iso), tz)).toBe(expected);
  });

  test('unknown time zone never fires', () => {
    expect(reminderDue(at('2026-10-13T10:00:00Z'), 'Mars/Olympus')).toBeNull();
  });

  test('every quarter-hour cron tick over a day fires exactly twice per zone', () => {
    for (const tz of ['Europe/London', 'Asia/Tehran', 'America/St_Johns', 'Asia/Kathmandu']) {
      const fired: string[] = [];
      for (let m = 0; m < 24 * 60; m += 15) {
        const slot = reminderDue(new Date(Date.UTC(2026, 9, 13, 0, m)), tz);
        if (slot) fired.push(slot);
      }
      expect(fired.sort()).toEqual(['evening', 'morning']);
    }
  });
});

test('isValidTimeZone', () => {
  expect(isValidTimeZone('Asia/Tehran')).toBe(true);
  expect(isValidTimeZone('Not/AZone')).toBe(false);
  expect(isValidTimeZone('')).toBe(false);
  expect(isValidTimeZone(42)).toBe(false);
});
