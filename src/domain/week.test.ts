import { weekIdOf, weekStart, weekEnd, shiftWeek, formatWeekRange } from './week';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('weekIdOf', () => {
  test('mid-week date', () => expect(weekIdOf(d(2026, 10, 9))).toBe('2026-W41'));
  test('Monday 00:00 starts the week', () => expect(weekIdOf(d(2026, 10, 5, 0))).toBe('2026-W41'));
  test('Sunday 23:59 ends the previous week', () =>
    expect(weekIdOf(new Date(2026, 9, 4, 23, 59))).toBe('2026-W40'));
  test('53-week year', () => expect(weekIdOf(d(2027, 1, 1))).toBe('2026-W53'));
  test('first week of next year', () => expect(weekIdOf(d(2027, 1, 4))).toBe('2027-W01'));
  test('late December belonging to next ISO year', () => expect(weekIdOf(d(2024, 12, 30))).toBe('2025-W01'));
  test('pads single-digit weeks', () => expect(weekIdOf(d(2026, 1, 7))).toBe('2026-W02'));
});

describe('weekStart / weekEnd', () => {
  test('start is local Monday 00:00', () => {
    expect(weekStart('2026-W41')).toEqual(new Date(2026, 9, 5));
  });
  test('end is next Monday 00:00', () => {
    expect(weekEnd('2026-W41')).toEqual(new Date(2026, 9, 12));
  });
  test('W01 of 2025 starts in 2024', () => {
    expect(weekStart('2025-W01')).toEqual(new Date(2024, 11, 30));
  });
});

describe('shiftWeek', () => {
  test('back one', () => expect(shiftWeek('2026-W41', -1)).toBe('2026-W40'));
  test('across year boundary', () => expect(shiftWeek('2026-W53', 1)).toBe('2027-W01'));
  test('back across year boundary', () => expect(shiftWeek('2027-W01', -1)).toBe('2026-W53'));
});

describe('formatWeekRange', () => {
  test('same month', () => expect(formatWeekRange('2026-W41')).toBe('5–11 Oct 2026'));
  test('spanning months', () => expect(formatWeekRange('2026-W40')).toBe('28 Sep – 4 Oct 2026'));
});
