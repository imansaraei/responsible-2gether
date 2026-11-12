import {
  addDays, allowanceStatus, daysLeftInMonth, piggyBank, dayKeyIn, daysInMonth, defaultAllowanceFor, formatGBP, monthKeyOf, monthRange,
  parseAmount, weekDaysInMonth, billsTotal, missionsWaiting,
} from './money';
import type { Bill, Mission, MoneyEntry } from './types';

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
  test('user example: £150 of £200 used by the 20th leaves £5 a day', () => {
    const s = allowanceStatus({ id: 'personal-a', monthlyAmount: 20_000 },
      [entry({ budgetId: 'personal-a', day: '2026-11-03', amount: 10_000 }), entry({ budgetId: 'personal-a', day: '2026-11-20', amount: 5_000 })],
      '2026-11-21');
    expect(s.daily).toBe(500);
    expect(s.monthLeft).toBe(5_000);
  });

  test('spending today changes tomorrow, not today', () => {
    const budget = { id: 'personal-a', monthlyAmount: 20_000 };
    const spent = [entry({ budgetId: 'personal-a', day: '2026-11-21', amount: 1_000 })];
    expect(allowanceStatus(budget, spent, '2026-11-21').daily).toBe(20_000 / 10);
    expect(allowanceStatus(budget, spent, '2026-11-21').todayLeft).toBe(1_000);
    expect(allowanceStatus(budget, spent, '2026-11-22').daily).toBe(19_000 / 9);
  });

  test('week allowance paces from the week’s first day in the month', () => {
    // Mon 16 Nov – Sun 22 Nov; £60 spent before the week, £1 on Tuesday.
    const s = allowanceStatus({ id: 'personal-a', monthlyAmount: 21_000 },
      [entry({ budgetId: 'personal-a', day: '2026-11-02', amount: 6_000 }), entry({ budgetId: 'personal-a', day: '2026-11-17', amount: 100 })],
      '2026-11-18');
    expect(s.weekAllowance).toBe((15_000 / 15) * 7);
    expect(s.weekSpent).toBe(100);
  });

  test('Piggy Bank top-ups raise the month allowance and are not spending', () => {
    const s = allowanceStatus({ id: 'personal-a', monthlyAmount: 20_000 },
      [entry({ budgetId: 'personal-a', day: '2026-11-21', amount: 3_000, kind: 'bank' })], '2026-11-21');
    expect(s.monthAllowance).toBe(23_000);
    expect(s.daily).toBe(2_300);
    expect(s.monthSpent).toBe(0);
    expect(s.loggedToday).toBe(false);
  });

  const tahereh = { id: 'personal-b', monthlyAmount: 25_000 };

  test('worked example: £250 on 1 October, £5 today', () => {
    const s = allowanceStatus(tahereh, [entry({ day: '2026-10-01', amount: 500 })], '2026-10-01');
    expect(formatGBP(s.daily)).toBe('£8.06');
    expect(formatGBP(s.weekAllowance)).toBe('£32.26'); // Thu 1 – Sun 4 Oct
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
    expect(s.daily).toBe(0); // nothing left to pace
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

test('daysLeftInMonth counts today', () => {
  expect(daysLeftInMonth('2026-11-21')).toBe(10);
  expect(daysLeftInMonth('2026-10-31')).toBe(1);
  expect(daysLeftInMonth('2026-10-01')).toBe(31);
});

describe('piggyBank', () => {
  const created = Date.parse('2026-10-16T09:00:00Z');
  const iman = { id: 'personal-a', monthlyAmount: 20_000, createdAt: created };
  const e = (p: Partial<MoneyEntry>) => entry({ budgetId: 'personal-a', by: 'a', ...p });

  test('starts at zero in the setup month', () => {
    expect(piggyBank(iman, [e({ day: '2026-10-16', amount: 500 })], '2026-10-20', 'Europe/London')).toBe(0);
  });

  test('banks each finished month’s leftover, never a negative one', () => {
    const entries = [
      e({ day: '2026-10-20', amount: 5_000 }),   // October leaves £150
      e({ day: '2026-11-03', amount: 30_000 }),  // November overspends: banks £0, doesn't subtract
      e({ day: '2026-11-04', kind: 'nothing', amount: 0 }),
      entry({ day: '2026-10-20', amount: 1 }),   // someone else's budget
    ];
    expect(piggyBank(iman, entries, '2026-11-10', 'Europe/London')).toBe(15_000);
    expect(piggyBank(iman, entries, '2026-12-01', 'Europe/London')).toBe(15_000);
  });

  test('moving money out lowers the balance; unspent top-ups come back at month end', () => {
    const entries = [e({ day: '2026-10-20', amount: 5_000 }), e({ day: '2026-11-05', amount: 4_000, kind: 'bank' })];
    expect(piggyBank(iman, entries, '2026-11-05', 'Europe/London')).toBe(11_000);
    // November: £200 + £40 top-up, nothing spent → £240 banked.
    expect(piggyBank(iman, entries, '2026-12-01', 'Europe/London')).toBe(15_000 + 24_000 - 4_000);
  });

  test('uses the household time zone for the setup month', () => {
    const lateSept = { ...iman, createdAt: Date.parse('2026-09-30T23:30:00Z') }; // 00:30 1 Oct in London
    expect(piggyBank(lateSept, [], '2026-10-15', 'Europe/London')).toBe(0);
    expect(piggyBank(lateSept, [], '2026-10-15', 'UTC')).toBe(20_000);
  });
});

describe('mission gifts', () => {
  // Iman (a) gives Tahereh (b) £5, approved on 21 Nov (30-day month, 10 days left counting today).
  const iman = { id: 'personal-a', monthlyAmount: 20_000, createdAt: Date.parse('2026-10-01T09:00:00Z') };
  const tahereh = { id: 'personal-b', monthlyAmount: 25_000, createdAt: Date.parse('2026-10-01T09:00:00Z') };
  const gifts = [
    entry({ id: 'gift-out-m1', budgetId: 'personal-a', by: 'a', day: '2026-11-21', amount: 500, label: 'Cupboards', kind: 'giftOut' }),
    entry({ id: 'gift-in-m1', budgetId: 'personal-b', by: 'a', day: '2026-11-21', amount: 500, label: 'Cupboards', kind: 'giftIn' }),
  ];

  test('the giver’s daily drops by 50p and the receiver’s rises by 50p, straight away', () => {
    const before = { a: allowanceStatus(iman, [], '2026-11-21'), b: allowanceStatus(tahereh, [], '2026-11-21') };
    const after = { a: allowanceStatus(iman, gifts, '2026-11-21'), b: allowanceStatus(tahereh, gifts, '2026-11-21') };
    expect(after.a.daily).toBe(before.a.daily - 50);
    expect(after.b.daily).toBe(before.b.daily + 50);
    expect(after.a.monthAllowance).toBe(19_500);
    expect(after.b.monthAllowance).toBe(25_500);
  });

  test('gifts are not spending and do not count as logging today', () => {
    const a = allowanceStatus(iman, gifts, '2026-11-21');
    expect(a.monthSpent).toBe(0);
    expect(a.todaySpent).toBe(0);
    expect(a.loggedToday).toBe(false);
    expect(allowanceStatus(tahereh, gifts, '2026-11-21').loggedToday).toBe(false);
  });

  test('Piggy Bank leftovers include the month’s gifts; gifts never reduce the bank directly', () => {
    expect(piggyBank(iman, gifts, '2026-12-02', 'Europe/London')).toBe(20_000 + 19_500);
    expect(piggyBank(tahereh, gifts, '2026-12-02', 'Europe/London')).toBe(25_000 + 25_500);
    expect(piggyBank(iman, gifts, '2026-11-25', 'Europe/London')).toBe(20_000);
  });
});

describe('billsTotal and missionsWaiting', () => {
  const bill = (p: Partial<Bill>): Bill => ({ id: 'x', owner: 'a', name: 'Phone', amount: 1_000, createdAt: 1, archivedAt: null, ...p });
  test('sums only the owner’s live bills', () => {
    expect(billsTotal([bill({}), bill({ amount: 2_500 }), bill({ owner: 'b' }), bill({ archivedAt: 5 })], 'a')).toBe(3_500);
    expect(billsTotal([], 'b')).toBe(0);
  });

  const mission = (p: Partial<Mission>): Mission => ({ id: 'm', from: 'a', to: 'b', title: 'Cupboards', gift: 500, status: 'open', createdAt: 1, updatedAt: 1, ...p });
  test('open ones for me and done ones waiting for my approval', () => {
    const ms = [
      mission({ id: '1' }), mission({ id: '2', status: 'done' }), mission({ id: '3', from: 'b', to: 'a', status: 'done' }),
      mission({ id: '4', from: 'b', to: 'a' }), mission({ id: '5', status: 'approved' }), mission({ id: '6', status: 'cancelled', from: 'b', to: 'a' }),
    ];
    expect(missionsWaiting(ms, 'b').map((m) => m.id)).toEqual(['1', '3']);
    expect(missionsWaiting(ms, 'a').map((m) => m.id)).toEqual(['2', '4']);
  });
});
