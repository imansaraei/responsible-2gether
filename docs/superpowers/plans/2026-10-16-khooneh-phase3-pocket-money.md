# Khooneh Phase 3 — Pocket Money Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Pocket Money module:
- personal and shared monthly budgets
- a five-second purchase entry
- "No spending today"
- what's left today, this week and this month
- Family, Mine and Home pot views
- a today strip on Home

Penalties, Second Chance and Piggy Bank come in phase 4.

**Architecture:**
- **Domain:** money is integer pence. Pure maths lives in `src/domain/money.ts`: household-time-zone day keys, month and week ranges, allowance status, and GBP parsing and formatting.
- **Storage:** Firestore holds `settings/app`, `budgets/{id}` and `money/{id}` under the household. One `PocketMoneyProvider` in `App` subscribes once (settings, budgets, this month's entries) and exposes `usePocketMoney()` to Home, the Money tab and the purchase sheet.
- **UI:** a `MoneyModule` mirrors `ChoresModule`, with sub-sections Family | Mine | Home pot. A one-time `MoneySetup` screen creates the budgets, because the admin panel arrives in phase 5.

**Tech Stack:** React 19, TypeScript 7, Vitest + Testing Library, Firestore (+ rules tests on the emulator), Cloudflare Worker deploy.

**Spec:** `docs/superpowers/specs/2026-10-16-family-command-center-design.md` (§5.1 Home today strip, §5.3 Pocket Money, §6.2 purchase flow, §7.1/§7.3 wireframes, §8 data model)

## Global Constraints

- **Money is integer pence everywhere** (storage, maths inputs). Display is `en-GB` GBP with 2 decimals, e.g. `£8.06`; negatives render with a leading minus, e.g. `-£1.20`.
- **A purchase is £0.01–£10,000** (1–1,000,000 pence). Labels are optional, ≤ 40 characters. A "No spending today" check-in is a `kind: 'nothing'` entry of 0 pence.
- **Days are `YYYY-MM-DD` in the household time zone** (`settings/app.timeZone`). It's set at Pocket Money setup from the device (`Intl.DateTimeFormat().resolvedOptions().timeZone`), falling back to `Europe/London`.
- **Week is Mon–Sun.** Weekly numbers count only the days of the current week that fall in the current month.
- **Allowance maths:**
  - daily = monthly ÷ days in month
  - week allowance = daily × (days of this week in this month)
  - today left = daily − spent today
  - week left = week allowance − spent this week
  - month left = monthly − spent this month
  - Values may go negative.
  - Worked example: Tahereh £250 in October (31 days) → daily **£8.06**, week **£56.45**, £5 spent today → **£3.06** left.
- **Starting budgets**, created by the setup screen and editable there before saving:
  - personal for member `a` and member `b`. The default amount is £250 if the member's name matches /tahereh/i, £200 if it matches /iman/i, otherwise £200.
  - shared **Home** £100.
  - Budget ids are fixed: `personal-a`, `personal-b`, `home`.
  - Personal budgets store `penalty: true` (used in phase 4). Home stores `penalty: false`.
- **Same-day rule (client-enforced):** new entries always use today's household day. Only your own entries from today can be deleted. The rules validate shape, not time, so backups with past entries can be restored.
- **Privacy (soft):**
  - Family view shows only totals per person and for Home, never labels or the partner's itemised entries.
  - Mine shows only my entries in my budget.
  - Home pot shows Home entries itemised to both.
- 44 px targets, no horizontal scroll at 375 px, light and dark tokens only.
- Edit CSS with targeted appends only. Never use broad `sed` on `styles.css`.
- Commits: conventional style, each ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/khooneh-money`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/domain/types.ts` | modify | `BudgetOwner`, `Budget`, `MoneyKind`, `MoneyEntry`, `MoneySettings` |
| `src/domain/money.ts` (+ test) | create | Day keys in a time zone, month/week ranges, `allowanceStatus`, `formatGBP`, `parseAmount`, `defaultAllowanceFor`, `familySummary` |
| `firestore.rules`, `tests/rules/firestore.rules.test.ts` | modify | `settings/app`, `budgets`, `money` |
| `src/firebase/repo.ts` | modify | `setupPocketMoney`, `addMoneyEntry`, `deleteMoneyEntry`, converters, export/import |
| `src/firebase/hooks.ts` | modify | `useMoney(code, monthKey)` |
| `src/domain/backup.ts` (+ test) | modify | Optional `money` section |
| `src/state/PocketMoneyContext.tsx` (+ test) | create | Provider + `usePocketMoney()` |
| `src/navigation.ts` | modify | `MoneySection`, `MONEY_SECTIONS`, `NavTarget.moneySection` |
| `src/components/PurchaseSheet.tsx` (+ test) | create | New-purchase dialog |
| `src/components/Toast.tsx` | create | Shared status toast + `useToast()` |
| `src/screens/MoneySetup.tsx` (+ test) | create | One-time budgets setup |
| `src/screens/MoneyMine.tsx`, `MoneyFamily.tsx`, `MoneyHomePot.tsx` (+ tests) | create | The three views |
| `src/screens/MoneyModule.tsx` (+ test) | create | Sub-nav host (replaces `MoneySoon`) |
| `src/screens/MoneySoon.tsx` | delete | |
| `src/screens/Home.tsx` (+ test) | modify | Today strip, ＋ Purchase, No spending today, Pocket Money card |
| `src/App.tsx` | modify | Provider + navigation |
| `src/styles.css` | modify | Tiles, sheet, entry lists |

---

### Task 1: Money domain

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/money.ts`, `src/domain/money.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export type BudgetOwner = MemberId | 'shared';
  export interface Budget { id: string; name: string; owner: BudgetOwner; monthlyAmount: number; penalty: boolean; order: number; createdAt: number; archivedAt: number | null }
  export type MoneyKind = 'purchase' | 'nothing';
  export interface MoneyEntry { id: string; budgetId: string; by: MemberId; day: string; amount: number; label: string; kind: MoneyKind; createdAt: number }
  export interface MoneySettings { timeZone: string; currency: 'GBP' }
  // money.ts
  export const MAX_AMOUNT = 1_000_000; export const MAX_LABEL = 40; export const FALLBACK_TIME_ZONE = 'Europe/London';
  export function dayKeyIn(d: Date, timeZone: string): string;
  export const monthKeyOf: (day: string) => string;            // 'YYYY-MM'
  export function daysInMonth(monthKey: string): number;
  export function addDays(day: string, n: number): string;
  export function weekDaysInMonth(day: string): string[];       // Mon–Sun of day's week, same month only
  export const monthRange: (monthKey: string) => { first: string; last: string };
  export interface AllowanceStatus { daily: number; weekAllowance: number; monthAllowance: number; todaySpent: number; weekSpent: number; monthSpent: number; todayLeft: number; weekLeft: number; monthLeft: number; loggedToday: boolean }
  export function allowanceStatus(budget: Pick<Budget, 'id' | 'monthlyAmount'>, entries: MoneyEntry[], today: string): AllowanceStatus;
  export function formatGBP(pence: number): string;
  export function parseAmount(s: string): number | null;
  export function defaultAllowanceFor(name: string): number;
  export const DEFAULT_HOME_ALLOWANCE = 10_000;
  ```

- [ ] **Step 1: Types**

Append to `src/domain/types.ts`:

```ts
export type BudgetOwner = MemberId | 'shared';

export interface Budget {
  id: string;
  name: string;
  owner: BudgetOwner;
  monthlyAmount: number; // pence
  penalty: boolean;      // phase 4: missed-day penalty applies
  order: number;
  createdAt: number;
  archivedAt: number | null;
}

export type MoneyKind = 'purchase' | 'nothing';

export interface MoneyEntry {
  id: string;
  budgetId: string;
  by: MemberId;
  day: string;     // YYYY-MM-DD in the household time zone
  amount: number;  // pence; 0 for 'nothing'
  label: string;   // '' when not given
  kind: MoneyKind;
  createdAt: number;
}

export interface MoneySettings {
  timeZone: string;
  currency: 'GBP';
}
```

- [ ] **Step 2: Failing tests**

`src/domain/money.test.ts`:

```ts
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
```

Run: `npx vitest run src/domain/money.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/domain/money.ts`:

```ts
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
```

Run: `npx vitest run src/domain/money.test.ts && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/domain
git commit -m "feat: pocket money domain — pence maths, household days, allowance status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Data layer — rules, repo, hook, backup

**Files:**
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`, `src/firebase/repo.ts`, `src/firebase/hooks.ts`, `src/domain/backup.ts`, `src/domain/backup.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `monthRange`.
- Produces:
  ```ts
  // repo.ts
  export async function setupPocketMoney(code: string, input: { timeZone: string; personal: { a: number; b: number }; home: number; names: { a: string; b: string } }): Promise<void>;
  export async function addMoneyEntry(code: string, input: { budgetId: string; by: MemberId; day: string; amount: number; label: string; kind: MoneyKind }, id?: string): Promise<void>;
  export async function deleteMoneyEntry(code: string, id: string): Promise<void>;
  export const toBudget: (id: string, d: Record<string, unknown>) => Budget;
  export const toMoneyEntry: (id: string, d: Record<string, unknown>) => MoneyEntry;
  // hooks.ts
  export function useMoney(code: string, monthKey: string): { settings: MoneySettings | null; budgets: Budget[]; entries: MoneyEntry[]; loading: boolean };
  // backup.ts
  Backup.money?: { settings: MoneySettings | null; budgets: Budget[]; entries: MoneyEntry[] }
  ```

- [ ] **Step 1: Failing rules tests**

Append to `tests/rules/firestore.rules.test.ts`, using its existing `authed()` and `h(...)` helpers:

```ts
const budget = { name: 'Tahereh', owner: 'b', monthlyAmount: 25000, penalty: true, order: 1, createdAt: 1, archivedAt: null };
const purchase = { budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase', createdAt: 1 };

test('pocket money settings: only the app doc, GBP, a time zone string', async () => {
  await assertSucceeds(setDoc(h(authed(), 'settings', 'app'), { timeZone: 'Europe/London', currency: 'GBP' }));
  await assertFails(setDoc(h(authed(), 'settings', 'other'), { timeZone: 'Europe/London', currency: 'GBP' }));
  await assertFails(setDoc(h(authed(), 'settings', 'app'), { timeZone: 'Europe/London', currency: 'USD' }));
  await assertFails(setDoc(h(authed(), 'settings', 'app'), { timeZone: '', currency: 'GBP' }));
});

test('budgets: owner a/b/shared, whole-pence amount up to £10,000', async () => {
  await assertSucceeds(setDoc(h(authed(), 'budgets', 'personal-b'), budget));
  await assertSucceeds(setDoc(h(authed(), 'budgets', 'home'), { ...budget, name: 'Home', owner: 'shared', penalty: false }));
  await assertFails(setDoc(h(authed(), 'budgets', 'x1'), { ...budget, owner: 'c' }));
  await assertFails(setDoc(h(authed(), 'budgets', 'x2'), { ...budget, monthlyAmount: 25.5 }));
  await assertFails(setDoc(h(authed(), 'budgets', 'x3'), { ...budget, monthlyAmount: 2_000_000 }));
  await assertFails(setDoc(h(authed(), 'budgets', 'x4'), { ...budget, extra: 1 }));
});

test('money entries: purchases > 0, nothing = 0, label ≤ 40, create-only, deletable', async () => {
  await assertSucceeds(setDoc(h(authed(), 'money', 'm1'), purchase));
  await assertSucceeds(setDoc(h(authed(), 'money', 'm2'), { ...purchase, kind: 'nothing', amount: 0, label: '' }));
  await assertFails(setDoc(h(authed(), 'money', 'm3'), { ...purchase, amount: 0 }));
  await assertFails(setDoc(h(authed(), 'money', 'm4'), { ...purchase, kind: 'nothing', amount: 100 }));
  await assertFails(setDoc(h(authed(), 'money', 'm5'), { ...purchase, amount: 5.5 }));
  await assertFails(setDoc(h(authed(), 'money', 'm6'), { ...purchase, label: 'x'.repeat(41) }));
  await assertFails(setDoc(h(authed(), 'money', 'm7'), { ...purchase, day: '16/10/2026' }));
  await assertFails(setDoc(h(authed(), 'money', 'm8'), { ...purchase, by: 'c' }));
  await assertFails(updateDoc(h(authed(), 'money', 'm1'), { amount: 100 }));
  await assertSucceeds(deleteDoc(h(authed(), 'money', 'm1')));
});
```

Run (Java 17 env as in README): `npm run test:rules`
Expected: the new tests FAIL.

- [ ] **Step 2: Rules**

In `firestore.rules`, add helpers next to the others:

```
    function validDay(d) { return d is string && d.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$'); }
    function validPence(n, min) { return n is int && n >= min && n <= 1000000; }
```

Inside `match /households/{code}`, alongside `chores` and `weeks`, add:

```
      match /settings/{docId} {
        allow read: if signedIn();
        allow create, update: if signedIn() && docId == 'app'
          && request.resource.data.keys().hasOnly(['timeZone', 'currency'])
          && validName(request.resource.data.timeZone, 64)
          && request.resource.data.currency == 'GBP';
      }

      match /budgets/{budgetId} {
        allow read: if signedIn();
        allow create, update: if signedIn()
          && request.resource.data.keys().hasOnly(['name', 'owner', 'monthlyAmount', 'penalty', 'order', 'createdAt', 'archivedAt'])
          && validName(request.resource.data.name, 30)
          && request.resource.data.owner in ['a', 'b', 'shared']
          && validPence(request.resource.data.monthlyAmount, 0)
          && request.resource.data.penalty is bool
          && request.resource.data.order is int
          && request.resource.data.createdAt is number
          && (request.resource.data.archivedAt == null || request.resource.data.archivedAt is number);
      }

      match /money/{entryId} {
        allow read, delete: if signedIn();
        allow create: if signedIn()
          && request.resource.data.keys().hasOnly(['budgetId', 'by', 'day', 'amount', 'label', 'kind', 'createdAt'])
          && request.resource.data.budgetId is string && request.resource.data.budgetId.size() > 0 && request.resource.data.budgetId.size() <= 100
          && isMember(request.resource.data.by)
          && validDay(request.resource.data.day)
          && request.resource.data.label is string && request.resource.data.label.size() <= 40
          && ((request.resource.data.kind == 'purchase' && validPence(request.resource.data.amount, 1))
              || (request.resource.data.kind == 'nothing' && request.resource.data.amount == 0))
          && request.resource.data.createdAt is number;
      }
```

Run: `npm run test:rules`
Expected: all pass.

- [ ] **Step 3: Backup (test first)**

In `src/domain/backup.test.ts`, using the file's existing valid fixture (`good`), add:

```ts
const moneySection = {
  settings: { timeZone: 'Europe/London', currency: 'GBP' },
  budgets: [{ id: 'personal-b', name: 'Tahereh', owner: 'b', monthlyAmount: 25000, penalty: true, order: 1, createdAt: 1, archivedAt: null }],
  entries: [{ id: 'm1', budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase', createdAt: 2 }],
};

test('accepts an optional money section', () => {
  expect(validateBackup(JSON.parse(JSON.stringify({ ...good, money: moneySection }))).ok).toBe(true);
  expect(validateBackup(JSON.parse(JSON.stringify({ ...good, money: { ...moneySection, settings: null } }))).ok).toBe(true);
});

test.each([
  ['budget owner', (m: any) => { m.budgets[0].owner = 'c'; }],
  ['fractional pence', (m: any) => { m.entries[0].amount = 5.5; }],
  ['nothing with amount', (m: any) => { m.entries[0].kind = 'nothing'; }],
  ['bad day', (m: any) => { m.entries[0].day = 'today'; }],
  ['long label', (m: any) => { m.entries[0].label = 'x'.repeat(41); }],
  ['currency', (m: any) => { m.settings.currency = 'USD'; }],
])('rejects a money section with bad %s', (_l, mutate) => {
  const m = JSON.parse(JSON.stringify(moneySection));
  mutate(m);
  expect(validateBackup({ ...JSON.parse(JSON.stringify(good)), money: m }).ok).toBe(false);
});
```

Run: `npx vitest run src/domain/backup.test.ts`
Expected: FAIL.

Then in `src/domain/backup.ts`:
- Add `money?: { settings: MoneySettings | null; budgets: Budget[]; entries: MoneyEntry[] }` to `Backup`, importing the types.
- Add validators, using the file's existing helpers:
  ```ts
  const isPence = (x: unknown, min: number) => Number.isInteger(x) && (x as number) >= min && (x as number) <= 1_000_000;
  const validBudget = (b: unknown) =>
    isObj(b) && isId(b.id) && isStr(b.name, 30) && (b.owner === 'a' || b.owner === 'b' || b.owner === 'shared') &&
    isPence(b.monthlyAmount, 0) && typeof b.penalty === 'boolean' && Number.isInteger(b.order) &&
    isNum(b.createdAt) && (b.archivedAt === null || isNum(b.archivedAt));
  const validMoneyEntry = (e: unknown) =>
    isObj(e) && isId(e.id) && isId(e.budgetId) && isMember(e.by) &&
    typeof e.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.day) &&
    typeof e.label === 'string' && e.label.length <= 40 && isNum(e.createdAt) &&
    ((e.kind === 'purchase' && isPence(e.amount, 1)) || (e.kind === 'nothing' && e.amount === 0));
  const validMoneySettings = (s: unknown) =>
    s === null || (isObj(s) && isStr(s.timeZone, 64) && s.currency === 'GBP');
  ```
- In `validateBackup`, after the weeks loop:
  ```ts
  if (x.money !== undefined) {
    const m = x.money;
    if (!isObj(m) || !validMoneySettings(m.settings) || !Array.isArray(m.budgets) || !m.budgets.every(validBudget)
      || !Array.isArray(m.entries) || !m.entries.every(validMoneyEntry)) return fail('Backup has an invalid Pocket Money section.');
  }
  ```

Run: `npx vitest run src/domain/backup.test.ts`
Expected: PASS.

- [ ] **Step 4: Repo**

In `src/firebase/repo.ts`:
- Import `Budget`, `MoneyEntry`, `MoneyKind` and `MoneySettings` from `../domain/types`.
- Add the collection helpers:
  ```ts
  const budgetsCol = (db: Firestore, code: string) => collection(db, 'households', code, 'budgets');
  const moneyCol = (db: Firestore, code: string) => collection(db, 'households', code, 'money');
  const settingsDoc = (db: Firestore, code: string) => doc(db, 'households', code, 'settings', 'app');
  ```
- Add after the chore-log functions:
  ```ts
  export async function setupPocketMoney(
    code: string,
    input: { timeZone: string; personal: { a: number; b: number }; home: number; names: { a: string; b: string } },
  ) {
    await ensureSignedIn();
    const db = getDb();
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(settingsDoc(db, code), { timeZone: input.timeZone, currency: 'GBP' });
    batch.set(doc(budgetsCol(db, code), 'personal-a'), { name: input.names.a.slice(0, 30), owner: 'a', monthlyAmount: input.personal.a, penalty: true, order: 0, createdAt: now, archivedAt: null });
    batch.set(doc(budgetsCol(db, code), 'personal-b'), { name: input.names.b.slice(0, 30), owner: 'b', monthlyAmount: input.personal.b, penalty: true, order: 1, createdAt: now, archivedAt: null });
    batch.set(doc(budgetsCol(db, code), 'home'), { name: 'Home', owner: 'shared', monthlyAmount: input.home, penalty: false, order: 2, createdAt: now, archivedAt: null });
    await track(batch.commit());
  }

  /** `id` lets the caller show the entry and delete it before the server acknowledges the write. */
  export async function addMoneyEntry(
    code: string,
    input: { budgetId: string; by: MemberId; day: string; amount: number; label: string; kind: MoneyKind },
    id: string = newId(),
  ) {
    await ensureSignedIn();
    await track(setDoc(doc(moneyCol(getDb(), code), id), {
      budgetId: input.budgetId, by: input.by, day: input.day, amount: input.amount,
      label: input.label.trim().slice(0, 40), kind: input.kind, createdAt: Date.now(),
    }));
  }

  export async function deleteMoneyEntry(code: string, id: string) {
    await ensureSignedIn();
    await track(deleteDoc(doc(moneyCol(getDb(), code), id)));
  }

  export const toBudget = (id: string, d: Record<string, unknown>): Budget => ({
    id, name: d.name as string, owner: d.owner as Budget['owner'], monthlyAmount: d.monthlyAmount as number,
    penalty: Boolean(d.penalty), order: (d.order as number) ?? 0, createdAt: d.createdAt as number,
    archivedAt: (d.archivedAt as number | null) ?? null,
  });
  export const toMoneyEntry = (id: string, d: Record<string, unknown>): MoneyEntry => ({
    id, budgetId: d.budgetId as string, by: d.by as MemberId, day: d.day as string, amount: d.amount as number,
    label: (d.label as string) ?? '', kind: d.kind as MoneyKind, createdAt: d.createdAt as number,
  });
  export const toMoneySettings = (d: Record<string, unknown> | undefined): MoneySettings | null =>
    d && typeof d.timeZone === 'string' ? { timeZone: d.timeZone, currency: 'GBP' } : null;
  ```
- `exportHousehold`:
  - Also read `getDocFromServer(settingsDoc(db, code))`, `getDocsFromServer(budgetsCol(db, code))` and `getDocsFromServer(moneyCol(db, code))`.
  - Add `money: { settings: toMoneySettings(s.exists() ? s.data() : undefined), budgets: [...].map(toBudget...), entries: [...].map(toMoneyEntry...) }` to the returned backup.
- `importHousehold`:
  - If `backup.money` is present:
    - `add` the settings doc (when not null) with `{ timeZone, currency: 'GBP' }`.
    - `add` each budget with exactly its 7 fields.
    - Money entries are create-only, so collect the existing money paths first and skip a `set` for any entry path that already exists, while still putting it in `keep`. This is the same pattern as logs; reuse `planLogWrites` (or a generalised helper) from `backup.ts`.
  - Include the budgets and money docs, and the settings doc, in the stale-docs scan.
  - When `backup.money` is undefined (an old backup), leave existing Pocket Money data untouched. Don't add those paths to the delete scan, so an old backup can't wipe new data.

- [ ] **Step 5: Hook**

In `src/firebase/hooks.ts`:
- Import `query`, `where` from `firebase/firestore`; `toBudget`, `toMoneyEntry`, `toMoneySettings` from `./repo`; the types; and `monthRange` from `../domain/money`.
- Add:

```ts
export function useMoney(code: string, monthKey: string) {
  const ready = useSignedIn();
  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [entries, setEntries] = useState<MoneyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const seen = { settings: false, budgets: false, entries: false };
    const settle = () => { if (seen.settings && seen.budgets && seen.entries) setLoading(false); };
    const mark = (k: keyof typeof seen) => { seen[k] = true; settle(); };
    const db = getDb();
    const { first, last } = monthRange(monthKey);
    const un1 = onSnapshot(doc(db, 'households', code, 'settings', 'app'),
      (s) => { setSettings(toMoneySettings(s.exists() ? s.data() : undefined)); mark('settings'); },
      (e) => { console.error(e); mark('settings'); });
    const un2 = onSnapshot(collection(db, 'households', code, 'budgets'),
      (s) => { setBudgets(s.docs.map((d) => toBudget(d.id, d.data())).filter((b) => b.archivedAt === null).sort((a, b) => a.order - b.order)); mark('budgets'); },
      (e) => { console.error(e); mark('budgets'); });
    const un3 = onSnapshot(query(collection(db, 'households', code, 'money'), where('day', '>=', first), where('day', '<=', last)),
      (s) => { setEntries(s.docs.map((d) => toMoneyEntry(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)); mark('entries'); },
      (e) => { console.error(e); mark('entries'); });
    return () => { un1(); un2(); un3(); };
  }, [ready, code, monthKey]);
  return { settings, budgets, entries, loading };
}
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npm test && npm run test:rules && npm run build`
Expected: all pass.

```bash
git add firestore.rules tests src
git commit -m "feat: pocket money rules, repo, live hook and backups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Provider, navigation, toast and purchase sheet

**Files:**
- Create: `src/state/PocketMoneyContext.tsx`, `src/state/PocketMoneyContext.test.tsx`, `src/components/Toast.tsx`, `src/components/PurchaseSheet.tsx`, `src/components/PurchaseSheet.test.tsx`
- Modify: `src/navigation.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useMoney`, `addMoneyEntry`, `dayKeyIn`, `monthKeyOf`, `allowanceStatus`, `formatGBP`, `parseAmount`, `FALLBACK_TIME_ZONE`, `useHousehold`.
- Produces:
  ```ts
  // navigation.ts
  export type MoneySection = 'family' | 'mine' | 'home';
  export const MONEY_SECTIONS: { id: MoneySection; label: string }[]; // Family | Mine | Home pot
  export interface NavTarget { tab: TabId; section?: ChoresSection; moneySection?: MoneySection }
  // PocketMoneyContext.tsx
  export interface PocketMoneyCtx { loading: boolean; isSetUp: boolean; timeZone: string; today: string; budgets: Budget[]; entries: MoneyEntry[]; budgetFor(owner: BudgetOwner): Budget | undefined }
  export const PocketMoneyContext: React.Context<PocketMoneyCtx | null>;
  export function PocketMoneyProvider(props: { code: string; children: ReactNode }): JSX.Element;
  export function usePocketMoney(): PocketMoneyCtx;
  // Toast.tsx
  export function useToast(ms?: number): { toast: string | null; show(text: string): void };
  export function Toast({ text }: { text: string | null }): JSX.Element; // always-mounted role=status
  // PurchaseSheet.tsx
  export type PurchaseSource = 'mine' | 'home';
  export function PurchaseSheet(props: { open: boolean; source?: PurchaseSource; onClose(): void; onSaved(message: string): void }): JSX.Element | null;
  ```

- [ ] **Step 1: Navigation**

In `src/navigation.ts`, add:

```ts
export type MoneySection = 'family' | 'mine' | 'home';

export const MONEY_SECTIONS: { id: MoneySection; label: string }[] = [
  { id: 'family', label: 'Family' },
  { id: 'mine', label: 'Mine' },
  { id: 'home', label: 'Home pot' },
];
```

and add `moneySection?: MoneySection;` to `NavTarget`.

- [ ] **Step 2: Provider (test first)**

`src/state/PocketMoneyContext.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { PocketMoneyProvider, usePocketMoney } from './PocketMoneyContext';

let money = { settings: null as null | { timeZone: string; currency: 'GBP' }, budgets: [] as unknown[], entries: [] as unknown[], loading: false };
vi.mock('../firebase/hooks', () => ({ useMoney: () => money }));

function Probe() {
  const m = usePocketMoney();
  return <p>{`${m.isSetUp}|${m.timeZone}|${m.today}|${m.budgetFor('shared')?.id ?? '-'}`}</p>;
}

test('not set up until settings and budgets exist; falls back to London', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
  expect(screen.getByText('false|Europe/London|2026-10-16|-')).toBeInTheDocument();
  vi.useRealTimers();
});

test('uses the household time zone for today and finds budgets by owner', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T21:00:00Z'));
  money = {
    loading: false, entries: [],
    settings: { timeZone: 'Asia/Tehran', currency: 'GBP' },
    budgets: [{ id: 'home', name: 'Home', owner: 'shared', monthlyAmount: 10000, penalty: false, order: 2, createdAt: 1, archivedAt: null }],
  };
  render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
  expect(screen.getByText('true|Asia/Tehran|2026-10-17|home')).toBeInTheDocument();
  vi.useRealTimers();
});
```

Run: `npx vitest run src/state/PocketMoneyContext.test.tsx`
Expected: FAIL.

`src/state/PocketMoneyContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMoney } from '../firebase/hooks';
import { dayKeyIn, FALLBACK_TIME_ZONE, monthKeyOf } from '../domain/money';
import type { Budget, BudgetOwner, MoneyEntry } from '../domain/types';

export interface PocketMoneyCtx {
  loading: boolean;
  isSetUp: boolean;
  timeZone: string;
  today: string;
  budgets: Budget[];
  entries: MoneyEntry[];
  budgetFor(owner: BudgetOwner): Budget | undefined;
}

export const PocketMoneyContext = createContext<PocketMoneyCtx | null>(null);

function useToday(timeZone: string): string {
  const [today, setToday] = useState(() => dayKeyIn(new Date(), timeZone));
  useEffect(() => {
    const tick = () => setToday(dayKeyIn(new Date(), timeZone));
    tick();
    const t = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [timeZone]);
  return today;
}

export function PocketMoneyProvider({ code, children }: { code: string; children: ReactNode }) {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(dayKeyIn(new Date(), FALLBACK_TIME_ZONE)));
  const { settings, budgets, entries, loading } = useMoney(code, monthKey);
  const timeZone = settings?.timeZone ?? FALLBACK_TIME_ZONE;
  const today = useToday(timeZone);
  useEffect(() => { if (monthKeyOf(today) !== monthKey) setMonthKey(monthKeyOf(today)); }, [today, monthKey]);

  const value = useMemo<PocketMoneyCtx>(() => ({
    loading,
    isSetUp: settings !== null && budgets.length > 0,
    timeZone, today, budgets, entries,
    budgetFor: (owner) => budgets.find((b) => b.owner === owner),
  }), [loading, settings, budgets, entries, timeZone, today]);

  return <PocketMoneyContext.Provider value={value}>{children}</PocketMoneyContext.Provider>;
}

export function usePocketMoney(): PocketMoneyCtx {
  const ctx = useContext(PocketMoneyContext);
  if (!ctx) throw new Error('usePocketMoney outside PocketMoneyProvider');
  return ctx;
}
```

Run: `npx vitest run src/state/PocketMoneyContext.test.tsx`
Expected: PASS.

In `src/App.tsx`, inside `Household`, wrap the rendered `<div className="app">…</div>` with `<PocketMoneyProvider code={code}>…</PocketMoneyProvider>`, inside the existing `HouseholdContext.Provider`.

- [ ] **Step 3: Toast**

`src/components/Toast.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';

export function useToast(ms = 4000) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast, ms]);
  const show = useCallback((text: string) => setToast(text), []);
  return { toast, show };
}

/** Always mounted so screen readers announce changes. */
export function Toast({ text }: { text: string | null }) {
  return (
    <div role="status" aria-live="polite" className={text ? 'toast' : 'sr-only'}>
      {text ?? ''}
    </div>
  );
}
```

`.sr-only` already exists in `styles.css`; check with grep. If it doesn't, append it.

- [ ] **Step 4: Purchase sheet (test first)**

`src/components/PurchaseSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { PocketMoneyContext, type PocketMoneyCtx } from '../state/PocketMoneyContext';
import type { Budget, MoneyEntry } from '../domain/types';
import { PurchaseSheet } from './PurchaseSheet';

const addMoneyEntry = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ addMoneyEntry: (...a: unknown[]) => addMoneyEntry(...(a as [])) }));

const household: HouseholdCtx = {
  code: 'c', me: 'b', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [], device: { code: 'c', me: 'b', lastExportAt: Date.now() }, updateDevice: () => {},
};
const budgets: Budget[] = [
  { id: 'personal-b', name: 'Tahereh', owner: 'b', monthlyAmount: 25000, penalty: true, order: 1, createdAt: 1, archivedAt: null },
  { id: 'home', name: 'Home', owner: 'shared', monthlyAmount: 10000, penalty: false, order: 2, createdAt: 1, archivedAt: null },
];
const money = (entries: MoneyEntry[] = []): PocketMoneyCtx => ({
  loading: false, isSetUp: true, timeZone: 'Europe/London', today: '2026-10-16', budgets, entries,
  budgetFor: (o) => budgets.find((b) => b.owner === o),
});
const renderSheet = (props: Partial<Parameters<typeof PurchaseSheet>[0]> = {}, entries: MoneyEntry[] = []) => {
  const onClose = vi.fn(); const onSaved = vi.fn();
  render(
    <HouseholdContext.Provider value={household}>
      <PocketMoneyContext.Provider value={money(entries)}>
        <PurchaseSheet open onClose={onClose} onSaved={onSaved} {...props} />
      </PocketMoneyContext.Provider>
    </HouseholdContext.Provider>,
  );
  return { onClose, onSaved };
};

afterEach(() => vi.clearAllMocks());

test('saving £5 to my allowance writes pence, today, me, and reports what is left', async () => {
  const { onSaved, onClose } = renderSheet();
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Amount'), '5');
  expect(screen.getByText('After this: £3.06 left today')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('What was it?'), 'Coffee');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c',
    { budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase' }, expect.any(String));
  expect(onSaved).toHaveBeenCalledWith('£5.00 — £3.06 left today');
  expect(onClose).toHaveBeenCalled();
});

test('Home source writes to the home budget and previews the pot', async () => {
  const { onSaved } = renderSheet({ source: 'home' });
  expect(screen.getByRole('radio', { name: 'Home pot' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.type(screen.getByLabelText('Amount'), '12.50');
  expect(screen.getByText('After this: £87.50 left in Home this month')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c', expect.objectContaining({ budgetId: 'home', amount: 1250 }), expect.any(String));
  expect(onSaved).toHaveBeenCalledWith('£12.50 — £87.50 left in Home this month');
});

test('invalid amounts cannot be saved', async () => {
  renderSheet();
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Amount'), '1.234');
  expect(save).toBeDisabled();
  expect(screen.getByText('Enter an amount like 4.50')).toBeInTheDocument();
});

test('recent labels from my past entries are offered as chips', async () => {
  renderSheet({}, [
    { id: '1', budgetId: 'personal-b', by: 'b', day: '2026-10-15', amount: 300, label: 'Snap', kind: 'purchase', createdAt: 3 },
    { id: '2', budgetId: 'personal-b', by: 'b', day: '2026-10-14', amount: 300, label: 'Coffee', kind: 'purchase', createdAt: 2 },
    { id: '3', budgetId: 'personal-a', by: 'a', day: '2026-10-14', amount: 300, label: 'Not mine', kind: 'purchase', createdAt: 1 },
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Snap' }));
  expect(screen.getByLabelText('What was it?')).toHaveValue('Snap');
  expect(screen.queryByRole('button', { name: 'Not mine' })).toBeNull();
});

test('Escape and Cancel close without saving', async () => {
  const { onClose } = renderSheet();
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(addMoneyEntry).not.toHaveBeenCalled();
});
```

Run: `npx vitest run src/components/PurchaseSheet.test.tsx`
Expected: FAIL.

`src/components/PurchaseSheet.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { addMoneyEntry } from '../firebase/repo';
import { allowanceStatus, formatGBP, MAX_LABEL, parseAmount } from '../domain/money';

export type PurchaseSource = 'mine' | 'home';

export function PurchaseSheet({ open, source = 'mine', onClose, onSaved }: {
  open: boolean; source?: PurchaseSource; onClose(): void; onSaved(message: string): void;
}) {
  const { code, me } = useHousehold();
  const { today, entries, budgetFor } = usePocketMoney();
  const [amountText, setAmountText] = useState('');
  const [label, setLabel] = useState('');
  const [from, setFrom] = useState<PurchaseSource>(source);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    setAmountText(''); setLabel(''); setFrom(source);
    requestAnimationFrame(() => amountRef.current?.focus());
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const budget = budgetFor(from === 'home' ? 'shared' : me);
  const amount = parseAmount(amountText);
  const recent = [...new Set(entries.filter((e) => e.by === me && e.label && e.kind === 'purchase')
    .sort((a, b) => b.createdAt - a.createdAt).map((e) => e.label))].slice(0, 5);

  const preview = (pence: number) => {
    if (!budget) return '';
    const s = allowanceStatus(budget, entries, today);
    return from === 'home'
      ? `${formatGBP(s.monthLeft - pence)} left in Home this month`
      : `${formatGBP(s.todayLeft - pence)} left today`;
  };

  function save(e: FormEvent) {
    e.preventDefault();
    if (amount === null || !budget) return;
    void addMoneyEntry(code, { budgetId: budget.id, by: me, day: today, amount, label, kind: 'purchase' }, crypto.randomUUID());
    onSaved(`${formatGBP(amount)} — ${preview(amount)}`);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 id={titleId}>New purchase</h2>
        <label>Amount
          <span className="amount-field">£<input ref={amountRef} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="0.00" /></span>
        </label>
        {amountText.trim() !== '' && amount === null && <p className="error small">Enter an amount like 4.50</p>}
        <label>What was it?
          <input value={label} maxLength={MAX_LABEL} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
        </label>
        {recent.length > 0 && (
          <div className="chips">
            {recent.map((r) => <button type="button" key={r} className="chip" onClick={() => setLabel(r)}>{r}</button>)}
          </div>
        )}
        <div className="kind-toggle" role="radiogroup" aria-label="Pay from">
          <button type="button" role="radio" aria-checked={from === 'mine'} className={from === 'mine' ? 'on plus' : ''} onClick={() => setFrom('mine')}>My allowance</button>
          <button type="button" role="radio" aria-checked={from === 'home'} className={from === 'home' ? 'on plus' : ''} onClick={() => setFrom('home')}>Home pot</button>
        </div>
        {amount !== null && budget && <p className="muted">After this: {preview(amount)}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={amount === null || !budget}>Save</button>
        </div>
      </form>
    </div>
  );
}
```

Append to `src/styles.css`:

```css
.sheet-backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / .35); display: flex; align-items: flex-end; justify-content: center; z-index: 30; }
.sheet { width: 100%; max-width: 560px; background: var(--surface); color: var(--text); border-radius: 18px 18px 0 0; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; box-shadow: 0 -8px 30px rgb(0 0 0 / .2); }
.sheet h2 { margin: 0; }
.amount-field { display: flex; align-items: center; gap: 6px; font-size: 1.6rem; font-weight: 700; color: var(--text); }
.amount-field input { flex: 1; min-width: 0; font-size: 1.6rem; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { min-height: 36px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font: inherit; cursor: pointer; }
.sheet-actions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; }
.sheet-actions .btn { min-height: 48px; }
```

Run: `npx vitest run src/components/PurchaseSheet.test.tsx && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: pocket money provider, toast and the new-purchase sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Money tab — setup, Mine, Family, Home pot

**Files:**
- Create: `src/screens/MoneySetup.tsx`, `src/screens/MoneyMine.tsx`, `src/screens/MoneyFamily.tsx`, `src/screens/MoneyHomePot.tsx`, `src/screens/MoneyModule.tsx` and a test for each (`MoneySetup.test.tsx`, `MoneyMine.test.tsx`, `MoneyFamily.test.tsx`, `MoneyHomePot.test.tsx`, `MoneyModule.test.tsx`)
- Modify: `src/App.tsx` (render `MoneyModule`; add `moneySection` state), `src/styles.css`
- Delete: `src/screens/MoneySoon.tsx`

**Interfaces:**
- Consumes: `usePocketMoney()`, `useHousehold()`, `allowanceStatus`, `formatGBP`, `parseAmount`, `defaultAllowanceFor`, `DEFAULT_HOME_ALLOWANCE`, `weekDaysInMonth`, `setupPocketMoney`, `addMoneyEntry`, `deleteMoneyEntry`, `PurchaseSheet`, `Toast`/`useToast`, `MONEY_SECTIONS`.
- Produces: `MoneyModule({ section, onSection }: { section: MoneySection; onSection(s: MoneySection): void })`.

Shared test fixtures: copy the `household` and `budgets` fixtures from the Task 3 test, with `me: 'b'` (Tahereh). Wrap renders in both context providers. Mock `../firebase/repo` (`addMoneyEntry`, `deleteMoneyEntry`, `setupPocketMoney` as `vi.fn(async () => {})`).

- [ ] **Step 1: MoneySetup (test first)**

Test (`MoneySetup.test.tsx`):
- With members Iman (a) and Tahereh (b), the inputs labelled `Iman’s monthly allowance`, `Tahereh’s monthly allowance` and `Home pot per month` are prefilled `200.00`, `250.00` and `100.00`.
- Changing Iman's to `180` and pressing **Start Pocket Money** calls `setupPocketMoney('c', { timeZone: <device tz or 'Europe/London'>, personal: { a: 18000, b: 25000 }, home: 10000, names: { a: 'Iman', b: 'Tahereh' } })`.
- An invalid amount, e.g. `abc`, disables the button and shows `Enter an amount like 250`.

Implementation notes:
- `MoneySetup` renders `<main className="page">` with `<h1>👛 Pocket Money</h1>` and a short intro. It says: "Set the monthly allowances. Each person’s is theirs to spend on anything; the Home pot is shared."
- Then a `.card.stack` form with three `<label>`ed `inputMode="decimal"` inputs. Defaults come from `defaultAllowanceFor(name)` and `DEFAULT_HOME_ALLOWANCE`, formatted as plain `(pence/100).toFixed(2)`. Amounts are parsed with `parseAmount`, and 0 is not allowed.
- Show the time zone line `Days follow ${timeZone} time.`, with `timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'`.
- The primary button is **Start Pocket Money**.

- [ ] **Step 2: MoneyMine (test first)**

Test (`MoneyMine.test.tsx`), as me = b with £250 and today 2026-10-16:
- With one £5.00 'Coffee' entry today, the tiles show `£3.06` (Today, `of £8.06`), `£51.45` (This week, `of £56.45`) and `£245.00` (This month, `of £250.00`).
- `No spending today` is hidden when today is already logged. Without entries it's shown, and clicking it calls `addMoneyEntry('c', { budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 0, label: '', kind: 'nothing' }, expect.any(String))`.
- The "This week" list shows today's `Coffee £5.00` with a button `Delete Coffee £5.00`, which calls `deleteMoneyEntry('c', id)`. An entry from 2026-10-14 is listed but has no delete button.
- The partner's entries (`by: 'a'`, `budgetId: 'personal-a'`) are never shown.
- `＋ Purchase` opens the dialog named `New purchase`.

Implementation notes:
- `<main className="page">`, then three tiles in a `.money-tiles` grid. Each tile has an uppercase caption (TODAY / THIS WEEK / THIS MONTH), the left amount via `formatGBP`, and `of £X`. Negative values get class `over`.
- Under the tiles: a `.home-actions` row with a `＋ Purchase` `btn primary big` button, and below it a `btn ghost` "No spending today" when `!loggedToday`.
- Then `<h2>This week</h2>` with my entries in my budget whose `day` is in `weekDaysInMonth(today)`, grouped by day (newest first).
  - Each day has a small heading like `Fri 16 Oct`, formatted from the day key via `new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })`.
  - Each row reads `{label || 'Purchase'}` and `formatGBP(amount)`. A `nothing` entry shows "No spending ✓".
  - Rows for today get the delete button.
- Empty state: `Nothing logged this week yet.`
- Use `useToast()` + `<Toast>` for the sheet's `onSaved` message.
- If my budget doesn't exist (not set up), render nothing; `MoneyModule` handles setup.

- [ ] **Step 3: MoneyFamily (test first)**

Test (`MoneyFamily.test.tsx`), with budgets personal-a £200, personal-b £250 and home £100:
- Entries: a £20.00 'Lunch', b £5.00 'Coffee', home £36.00 'Groceries'.
- The view shows `Iman` with `£180.00 left` and `£20.00 spent`, `Tahereh` with `£245.00 left` and `£5.00 spent`, and `Home pot` with `£64.00 left`.
- **No labels** ('Lunch', 'Coffee', 'Groceries') appear anywhere.

Implementation notes:
- A `.cards` list of `.card` rows. Each row has the dot colour (`memberColor` for a and b; the accent for Home), the name, the month left in large text, and `{spent} spent` muted text.
- Only month numbers. A line at the bottom: `Totals only — each person’s purchases stay private to them.`

- [ ] **Step 4: MoneyHomePot (test first)**

Test (`MoneyHomePot.test.tsx`):
- Shows `£64.00 left this month` and `of £100.00`.
- Lists this month's home entries itemised, newest first, with who logged each one (`Groceries · Iman · £36.00`).
- My own today entries have a delete button; others don't.
- `＋ Home purchase` opens the sheet with `Home pot` pre-selected.

- [ ] **Step 5: MoneyModule (test first)**

Test (`MoneyModule.test.tsx`), mocking the three views and `MoneySetup` like the `ChoresModule` test:
- When `isSetUp` is false it renders the setup screen and no tabs.
- When set up, it renders `👛 Pocket Money` with tabs `Family | Mine | Home pot`, shows the requested section, and reports clicks. It mirrors `ChoresModule`'s ARIA tabs (roving tabindex, arrows, Home/End).
- While `loading`, it renders `Loading…`.

Implementation: copy `ChoresModule`'s structure and keyboard handling, using `MONEY_SECTIONS` and ids `money-tab-*` / `money-panel`.

- [ ] **Step 6: Wire App**

In `src/App.tsx`:
- Add `const [moneySection, setMoneySection] = useState<MoneySection>('mine');`.
- In `navigate`, add `if (t.moneySection) setMoneySection(t.moneySection);`.
- Render `<MoneyModule section={moneySection} onSection={setMoneySection} />` for the money tab.
- Delete `MoneySoon`.

Append styles to `src/styles.css`:

```css
.money-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.money-tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.money-tile .cap { font-size: .7rem; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
.money-tile .big { font-size: 1.25rem; font-weight: 800; overflow-wrap: anywhere; }
.money-tile .big.over { color: var(--danger); }
.money-tile:first-child .big { font-size: 1.5rem; }
.entry-day { font-size: .8rem; color: var(--muted); margin: 12px 0 4px; }
.entry-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.entry-row .entry-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.entry-row .entry-amount { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.family-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px; }
.family-row .big { font-size: 1.2rem; font-weight: 800; text-align: end; }
.family-row .muted { grid-column: 2 / 4; text-align: end; }
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: PASS.

```bash
git add -A src
git commit -m "feat: Pocket Money tab — setup, Mine, Family and Home pot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Home command centre — today strip and Pocket Money card

**Files:**
- Modify: `src/screens/Home.tsx`, `src/screens/Home.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `usePocketMoney()`, `allowanceStatus`, `formatGBP`, `addMoneyEntry`, `PurchaseSheet`, `useToast`/`Toast`, `NavTarget.moneySection`.

- [ ] **Step 1: Tests first**

In `src/screens/Home.test.tsx`:
- Wrap renders in a `PocketMoneyContext.Provider`. Default fixture: not set up, with `isSetUp: false`, no budgets and no entries.
- Mock `../firebase/repo` with `addMoneyEntry: vi.fn(async () => {})`.
- Keep all existing tests passing. Add:

```tsx
test('not set up: Pocket Money card offers setup and opens Money', async () => {
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: /Pocket Money/ }));
  expect(screen.getByRole('button', { name: /Pocket Money/ })).toHaveTextContent('Set up your allowances');
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money' });
  expect(screen.queryByText(/left today/)).toBeNull();
});

test('set up: today strip shows what is left and the family card shows totals only', async () => {
  money = setUpMoney([{ id: 'e1', budgetId: 'personal-a', by: 'a', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase', createdAt: 1 }]);
  const nav = renderHome();
  expect(screen.getByText('£1.45')).toBeInTheDocument();          // £200/31 = £6.45 − £5
  expect(screen.getByText('left today')).toBeInTheDocument();
  expect(screen.getByText(/this week/)).toBeInTheDocument();
  const card = screen.getByRole('button', { name: /Pocket Money/ });
  expect(card).toHaveTextContent('You £195.00 left');
  expect(card).toHaveTextContent('Tahereh £250.00 left');
  expect(card).toHaveTextContent('Home £100.00 left');
  expect(card).not.toHaveTextContent('Coffee');
  await userEvent.click(card);
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money', moneySection: 'family' });
});

test('＋ Purchase opens the sheet; No spending today logs a £0 check-in', async () => {
  money = setUpMoney([]);
  renderHome();
  await userEvent.click(screen.getByRole('button', { name: 'No spending today' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('tidy-otter-maple-4821',
    { budgetId: 'personal-a', by: 'a', day: '2026-10-16', amount: 0, label: '', kind: 'nothing' }, expect.any(String));
  await userEvent.click(screen.getByRole('button', { name: '＋ Purchase' }));
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
});
```

Define `setUpMoney(entries)` in the test file. It returns a `PocketMoneyCtx` with:
- `isSetUp: true`, `today: '2026-10-16'`, `timeZone: 'Europe/London'`
- budgets personal-a £200 (Iman, me in the existing fixture), personal-b £250 and home £100
- the given entries, and `budgetFor`
- a `money` module variable defaulting to the not-set-up context, reset in `beforeEach`

Run: `npx vitest run src/screens/Home.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 2: Implement**

In `src/screens/Home.tsx`:

When `isSetUp` and my budget exists, render a today strip between the alerts and the chore button:

```tsx
<section className="today-strip card" aria-label="My pocket money today">
  <div className="today-big"><strong className={s.todayLeft < 0 ? 'over' : ''}>{formatGBP(s.todayLeft)}</strong> <span>left today</span></div>
  <div className="muted small">{formatGBP(s.weekLeft)} this week · {formatGBP(s.monthLeft)} this month</div>
</section>
```

where `s = allowanceStatus(myBudget, entries, today)`.

The actions row becomes two buttons, `＋ Purchase` (opens the `PurchaseSheet`) and `＋ Chore` (unchanged navigation). `.home-actions` becomes a 2-column grid when Pocket Money is set up. Then:

```tsx
{!s.loggedToday && <button className="btn ghost" onClick={noSpending}>No spending today</button>}
```

where `noSpending` calls `addMoneyEntry(code, { budgetId: myBudget.id, by: me, day: today, amount: 0, label: '', kind: 'nothing' }, crypto.randomUUID())` and shows the toast `Logged: no spending today`.

The Pocket Money card:
- **Not set up:** the body is `<span className="muted">Set up your allowances</span>` and it navigates to `{ tab: 'money' }`.
- **Set up:** the body lists `You {formatGBP(monthLeft)} left`, `{partner name} {…} left` and `Home {…} left`, each on its own line, computed with `allowanceStatus` per budget. It navigates to `{ tab: 'money', moneySection: 'family' }`.

Render `<PurchaseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={show} />` and `<Toast text={toast} />`.

Append to `src/styles.css`:

```css
.today-strip { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
.today-big { display: flex; align-items: baseline; gap: 8px; }
.today-big strong { font-size: 2rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.today-big strong.over { color: var(--danger); }
.home-actions.two { grid-template-columns: 1fr 1fr; }
```

Run: `npx vitest run src/screens/Home.test.tsx && npx tsc --noEmit && npm test && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: Home today strip, ＋ Purchase, no-spending check-in and family money card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Phone check and release prep (controller)

- [ ] **README.** Add a "Pocket Money" section:
  - allowances and the maths (daily = monthly ÷ days; week = this week's days in this month)
  - log purchases the same day
  - "No spending today"
  - Family shows totals only
  - penalties and the Piggy Bank are coming in phase 4
- [ ] **Emulator check** at 375 × 812, light and dark:
  - run setup
  - log a purchase: the toast appears and the numbers update in Mine, Home and Family
  - log a Home pot purchase from the second "phone" (a second origin) and see it itemised there and in totals only on Family
  - use "No spending today"
  - delete today's entry
  - no horizontal scroll
- [ ] **Release order** (after the user approves): deploy the rules (`npx firebase deploy --only firestore:rules --project responsible-2gether`), then the app (`npm run deploy`).
