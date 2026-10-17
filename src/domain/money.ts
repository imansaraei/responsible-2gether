import type { Budget, MoneyEntry } from './types';

export const MAX_AMOUNT = 1_000_000; // £10,000 in pence
export const MAX_LABEL = 40;
export const FALLBACK_TIME_ZONE = 'Europe/London';
export const DEFAULT_HOME_ALLOWANCE = 10_000;

export function dayKeyIn(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export const monthKeyOf = (day: string) => day.slice(0, 7);

const toUTC = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const monthRange = (monthKey: string) => ({
  first: `${monthKey}-01`,
  last: `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`,
});

export function addDays(day: string, n: number): string {
  const d = toUTC(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function weekDaysInMonth(day: string): string[] {
  const mondayOffset = (toUTC(day).getUTCDay() + 6) % 7; // Mon = 0
  const monday = addDays(day, -mondayOffset);
  const month = monthKeyOf(day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => monthKeyOf(d) === month);
}

export interface AllowanceStatus {
  daily: number;
  weekAllowance: number;
  monthAllowance: number;
  todaySpent: number;
  weekSpent: number;
  monthSpent: number;
  todayLeft: number;
  weekLeft: number;
  monthLeft: number;
  loggedToday: boolean;
}

const sum = (xs: MoneyEntry[]) => xs.reduce((s, e) => s + e.amount, 0);
const purchases = (xs: MoneyEntry[]) => xs.filter((e) => e.kind === 'purchase');
const topUps = (xs: MoneyEntry[]) => xs.filter((e) => e.kind === 'bank');

/** Days from `day` to the end of its month, counting `day` itself. */
export const daysLeftInMonth = (day: string) => daysInMonth(monthKeyOf(day)) - Number(day.slice(8, 10)) + 1;

/**
 * Daily and weekly allowances pace the money left: what was left at the start of today (or of this week)
 * divided by the days left, so spending today changes tomorrow's daily figure, not today's.
 * Piggy Bank top-ups (kind 'bank') raise this month's allowance; only purchases count as spending.
 */
export function allowanceStatus(budget: Pick<Budget, 'id' | 'monthlyAmount'>, entries: MoneyEntry[], today: string): AllowanceStatus {
  const month = monthKeyOf(today);
  const mine = entries.filter((e) => e.budgetId === budget.id && monthKeyOf(e.day) === month);
  const spent = purchases(mine);
  const weekDays = weekDaysInMonth(today);
  const week = new Set(weekDays);
  const monthAllowance = budget.monthlyAmount + sum(topUps(mine));
  const leftBefore = (day: string) => Math.max(0, monthAllowance - sum(spent.filter((e) => e.day < day)));
  const daily = leftBefore(today) / daysLeftInMonth(today);
  const weekAllowance = (leftBefore(weekDays[0]) / daysLeftInMonth(weekDays[0])) * week.size;
  const todaySpent = sum(spent.filter((e) => e.day === today));
  const weekSpent = sum(spent.filter((e) => week.has(e.day)));
  const monthSpent = sum(spent);
  return {
    daily, weekAllowance, monthAllowance,
    todaySpent, weekSpent, monthSpent,
    todayLeft: daily - todaySpent,
    weekLeft: weekAllowance - weekSpent,
    monthLeft: monthAllowance - monthSpent,
    loggedToday: mine.some((e) => e.day === today && e.kind !== 'bank'),
  };
}

export const BANK_LABEL = 'From Piggy Bank';

/**
 * The Piggy Bank balance: every finished month since the budget was created banks its leftover
 * (never less than zero), minus everything moved out of the bank so far, this month included.
 */
export function piggyBank(budget: Pick<Budget, 'id' | 'monthlyAmount' | 'createdAt'>, entries: MoneyEntry[], today: string, timeZone: string): number {
  const mine = entries.filter((e) => e.budgetId === budget.id);
  const thisMonth = monthKeyOf(today);
  let month = monthKeyOf(dayKeyIn(new Date(budget.createdAt), timeZone));
  let saved = 0;
  while (month < thisMonth) {
    const inMonth = mine.filter((e) => monthKeyOf(e.day) === month);
    saved += Math.max(0, budget.monthlyAmount + sum(topUps(inMonth)) - sum(purchases(inMonth)));
    month = monthKeyOf(addDays(monthRange(month).last, 1));
  }
  return saved - sum(topUps(mine.filter((e) => monthKeyOf(e.day) <= thisMonth)));
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Sign handled manually: Intl renders negatives inconsistently across runtimes.
export const formatGBP = (pence: number): string => {
  const r = Math.round(pence);
  return (r < 0 ? '-' : '') + gbp.format(Math.abs(r) / 100);
};

export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/^£/, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const pence = Math.round(Number(t) * 100);
  return pence >= 1 && pence <= MAX_AMOUNT ? pence : null;
}

export function defaultAllowanceFor(name: string): number {
  if (/tahereh/i.test(name)) return 25_000;
  return 20_000;
}
