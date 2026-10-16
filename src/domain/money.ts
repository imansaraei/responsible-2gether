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

export function allowanceStatus(budget: Pick<Budget, 'id' | 'monthlyAmount'>, entries: MoneyEntry[], today: string): AllowanceStatus {
  const month = monthKeyOf(today);
  const mine = entries.filter((e) => e.budgetId === budget.id && monthKeyOf(e.day) === month);
  const week = new Set(weekDaysInMonth(today));
  const sum = (xs: MoneyEntry[]) => xs.reduce((s, e) => s + e.amount, 0);
  const daily = budget.monthlyAmount / daysInMonth(month);
  const weekAllowance = daily * week.size;
  const todaySpent = sum(mine.filter((e) => e.day === today));
  const weekSpent = sum(mine.filter((e) => week.has(e.day)));
  const monthSpent = sum(mine);
  return {
    daily, weekAllowance, monthAllowance: budget.monthlyAmount,
    todaySpent, weekSpent, monthSpent,
    todayLeft: daily - todaySpent,
    weekLeft: weekAllowance - weekSpent,
    monthLeft: budget.monthlyAmount - monthSpent,
    loggedToday: mine.some((e) => e.day === today),
  };
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
