import {
  addDays, allowanceStatus, dayKeyIn, daysInMonth, defaultAllowanceFor, formatGBP, monthKeyOf, monthRange,
  parseAmount, weekDaysInMonth,
} from './money';
import type { MoneyEntry } from './types';

const entry = (p: Partial<MoneyEntry>): MoneyEntry => ({
  id: Math.random().toString(36), budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: '', kind: 'purchase', createdAt: 1, ...p,
});

describe('day keys in the household time zone', () => {
  test.each([
    ['2026-10-16T22:30:00Z', 'Europe/London', '2026-10-16'],  // 23:30 BST
    ['2026-10-16T23:30:00Z', 'Europe/London', '2026-10-17'],  // 00:30 BST next day
    ['2026-10-16T21:00:00Z', 'Asia/Tehran', '2026-10-17'],    // 00:30 +03:30
    ['2026-12-01T00:30:00Z', 'Europe/London', '2026-12-01'],  // GMT
  ])('%s in %s → %s', (iso, tz, day) => {
    expect(dayKeyIn(new Date(iso), tz)).toBe(day);
  });
});

test('month helpers', () => {
  expect(monthKeyOf('2026-10-16')).toBe('2026-10');
  expect(daysInMonth('2026-10')).toBe(31);
  expect(daysInMonth('2026-02')).toBe(28);
  expect(daysInMonth('2028-02')).toBe(29);
  expect(monthRange('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' });
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('weekDaysInMonth is Mon–Sun clipped to the month', () => {
  expect(weekDaysInMonth('2026-10-16')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  expect(weekDaysInMonth('2026-10-01')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']); // Thu
  expect(weekDaysInMonth('2026-10-31')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']); // Sat
});

describe('allowanceStatus', () => {
  const tahereh = { id: 'personal-b', monthlyAmount: 25_000 };

  test('worked example: £250 in October, £5 today', () => {
    const s = allowanceStatus(tahereh, [entry({ amount: 500 })], '2026-10-16');
    expect(formatGBP(s.daily)).toBe('£8.06');
    expect(formatGBP(s.weekAllowance)).toBe('£56.45');
    expect(formatGBP(s.todayLeft)).toBe('£3.06');
    expect(s.monthLeft).toBe(24_500);
    expect(s.loggedToday).toBe(true);
  });

  test('only this budget and this month count; week counts this week’s days in this month', () => {
    const s = allowanceStatus(tahereh, [
      entry({ day: '2026-10-12', amount: 1000 }),         // this week
      entry({ day: '2026-10-05', amount: 2000 }),         // earlier this month
      entry({ day: '2026-09-30', amount: 9999 }),         // last month
      entry({ budgetId: 'home', amount: 7777 }),          // other budget
      entry({ day: '2026-10-16', kind: 'nothing', amount: 0 }),
    ], '2026-10-16');
    expect(s.todaySpent).toBe(0);
    expect(s.weekSpent).toBe(1000);
    expect(s.monthSpent).toBe(3000);
    expect(s.loggedToday).toBe(true); // the £0 check-in counts as logged
  });

  test('not logged today and overspend goes negative', () => {
    const s = allowanceStatus({ id: 'personal-a', monthlyAmount: 3100 }, [entry({ budgetId: 'personal-a', day: '2026-10-15', amount: 5000 })], '2026-10-16');
    expect(s.loggedToday).toBe(false);
    expect(s.daily).toBe(100);
    expect(s.monthLeft).toBe(-1900);
    expect(formatGBP(s.monthLeft)).toBe('-£19.00');
  });
});

test.each([
  ['5', 500], ['5.5', 550], ['5,50', 550], ['£12.34', 1234], [' 0.01 ', 1], ['10000', 1_000_000],
  ['', null], ['0', null], ['-3', null], ['1.234', null], ['abc', null], ['10000.01', null],
])('parseAmount(%j) = %s', (s, p) => {
  expect(parseAmount(s)).toBe(p);
});

test('formatGBP rounds pence and uses thousands separators', () => {
  expect(formatGBP(806.45)).toBe('£8.06');
  expect(formatGBP(0)).toBe('£0.00');
  expect(formatGBP(123456)).toBe('£1,234.56');
});

test('defaultAllowanceFor matches names', () => {
  expect(defaultAllowanceFor('Tahereh')).toBe(25_000);
  expect(defaultAllowanceFor('Iman')).toBe(20_000);
  expect(defaultAllowanceFor('Alex')).toBe(20_000);
});
