# Khooneh Phase 2 — Tidy Together Time Blocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weekly completion percentages with time-block logging. Each chore has a block length. People log +1×/+2×/+3× blocks with a 10 s undo, and the weekly chart shows minutes per person. Old weeks stay viewable.

**Architecture:**
- **Domain:** new pure logic in `src/domain/blocks.ts` (block sizes, parsing, formatting, today key) and `src/domain/weekSummary.ts` (one week summary for both the new blocks mode and the legacy percent mode, all in minutes).
- **Data:** logs live at `households/{code}/weeks/{weekId}/logs/{logId}`, next to completions and feedback, so `useWeek`, export and import extend naturally. Chores gain an optional `blockMinutes`. When it's missing, the default comes from the chore's name, so no data migration is needed.
- **UI:** a `ChoreLogger` list replaces the percent buttons in To-do. `Dashboard` and `Home` both render from `summarizeWeek`.

**Tech Stack:** React 19, TypeScript 7, Vitest + Testing Library, Firestore (+ rules tests on the emulator), Cloudflare Worker deploy.

**Spec:** `docs/superpowers/specs/2026-10-16-family-command-center-design.md` (§5.2 Tidy Together, §6.1 flow, §7.2 wireframe)

## Global Constraints

- **Block length:** whole minutes, multiple of 5, from 5 to 240. **Multipliers:** 1, 2, 3. **Logged minutes** = block × multiplier.
- **Default blocks by chore name:**

  | Chore | Block | Chore | Block |
  |---|---|---|---|
  | Empty dishes | 10 | Drying up the toilet | 5 |
  | Load the dishwasher | 15 | Tidy up the bedroom | 15 |
  | Load the washing machine | 10 | Tidy up the hallway | 10 |
  | Empty the washing machine | 15 | Taking out the trash | 5 |
  | Washing the toilet | 20 | Cleaning the fridge | 20 |
  | Tidy up living room | 15 | Cooking | 45 |
  | Tidy up kitchen | 15 | Sorting out the groceries | 15 |

  Any other name defaults to 15.
- **Logs** are written to the current week, with `day` = the device's local `YYYY-MM-DD`. Minutes are credited to whoever logged them (`by`), whoever the assignee is.
- **Undo** is offered in a toast for 10 seconds after each log.
- **Week mode:** a week with completions but no logs is **legacy**, shown as before but converted to minutes. Every other week is **blocks**.
- Feedback, helpfulness, the 2:1 warning and the To-do feedback tasks are unchanged.
- Minutes are displayed as `45 m`, `1 h`, `1 h 30 m`.
- 44 px targets, no horizontal scroll at 375 px, light and dark tokens only.
- Commits: conventional style, each ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/khooneh-blocks`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/domain/types.ts` | modify | `Chore.blockMinutes?`, `Multiplier`, `MULTIPLIERS`, `ChoreLog` |
| `src/domain/blocks.ts` (+ test) | create | Defaults, `blockMinutesOf`, `clampBlockMinutes`, `parseBlockMinutes`, `legacyHoursFor`, `formatMinutes`, `todayKey`, `todayCount` |
| `src/domain/weekSummary.ts` (+ test) | create | `weekMode`, `blockSlices`, `memberMinutes`, `minuteShares`, `summarizeWeek` |
| `src/domain/starterChores.ts` (+ test) | modify | Add `blockMinutes` to starters |
| `src/domain/backup.ts` (+ test) | modify | Optional `blockMinutes` on chores; optional `logs` per week |
| `firestore.rules`, `tests/rules/firestore.rules.test.ts` | modify | `blockMinutes` on chores; `logs` subcollection |
| `src/firebase/repo.ts` | modify | `addLog`, `deleteLog`, `toLog`, blockMinutes in create/add/update chore, logs in export/import; remove `setCompletion` |
| `src/firebase/hooks.ts` | modify | `useWeek` also returns `logs` |
| `src/components/ChoreLogger.tsx` (+ test) | create | Chore list with expand → multiplier → Add, today counts, undo toast |
| `src/screens/Todo.tsx` (+ test) | modify | ChoreLogger replaces the percent section |
| `src/components/SegmentedPercent.tsx` (+ test) | delete | No longer used |
| `src/screens/Dashboard.tsx` (+ test) | modify | Render from `summarizeWeek` (minutes) |
| `src/screens/Home.tsx` (+ test) | modify | Split from `summarizeWeek` |
| `src/screens/Config.tsx` (+ test) | modify | Block minutes instead of hours |
| `src/styles.css` | modify | Logger rows, toast |
| `README.md` | modify | "How scoring works" for blocks |

---

### Task 1: Domain — blocks and week summary

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/starterChores.ts`, `src/domain/starterChores.test.ts`
- Create: `src/domain/blocks.ts`, `src/domain/blocks.test.ts`, `src/domain/weekSummary.ts`, `src/domain/weekSummary.test.ts`

**Interfaces:**
- Consumes (existing): `choresForWeek(weekId, chores, completions, isCurrent)`, `donutSlices(views)`, `memberHours(views)`, `sharePercents(views)`, `DonutSlice` from `src/domain/scoring.ts`; `MEMBER_IDS`, `MemberId`.
- Produces:
  ```ts
  // types.ts
  export interface Chore { …existing…; blockMinutes?: number }
  export type Multiplier = 1 | 2 | 3;
  export const MULTIPLIERS: Multiplier[];
  export interface ChoreLog { id: string; choreId: string; name: string; by: MemberId; multiplier: Multiplier; minutes: number; day: string; createdAt: number }
  // blocks.ts
  export const DEFAULT_BLOCK_MINUTES: Record<string, number>;
  export const FALLBACK_BLOCK_MINUTES = 15; export const MIN_BLOCK_MINUTES = 5; export const MAX_BLOCK_MINUTES = 240;
  export function blockMinutesOf(c: Pick<Chore, 'name' | 'blockMinutes'>): number;
  export function clampBlockMinutes(n: number): number;
  export function parseBlockMinutes(s: string): number | null;
  export function legacyHoursFor(blockMinutes: number): number;
  export function formatMinutes(m: number): string;
  export function todayKey(d?: Date): string;
  export function todayCount(logs: ChoreLog[], choreId: string, by: MemberId, day: string): number;
  // weekSummary.ts
  export type WeekMode = 'blocks' | 'legacy';
  export function weekMode(logs: ChoreLog[], completions: Completion[]): WeekMode;
  export function blockSlices(logs: ChoreLog[]): DonutSlice[];
  export function memberMinutes(logs: ChoreLog[]): { a: number; b: number; total: number };
  export function minuteShares(logs: ChoreLog[]): { a: number; b: number };
  export interface WeekSummary { mode: WeekMode; slices: DonutSlice[]; pct: { a: number; b: number }; done: { a: number; b: number; total: number }; planned: number | null }
  export function summarizeWeek(weekId: string, chores: Chore[], completions: Completion[], logs: ChoreLog[], isCurrent: boolean): WeekSummary;
  // starterChores.ts
  export const STARTER_CHORES: { name: string; hours: number; blockMinutes: number }[];
  ```

- [ ] **Step 1: Types**

In `src/domain/types.ts`, add `blockMinutes?: number;` to `Chore` after `hours: number;`, and append:

```ts
export type Multiplier = 1 | 2 | 3;
export const MULTIPLIERS: Multiplier[] = [1, 2, 3];

export interface ChoreLog {
  id: string;
  choreId: string;
  name: string;       // chore name at the time of logging
  by: MemberId;       // who did it (credited the minutes)
  multiplier: Multiplier;
  minutes: number;    // block × multiplier
  day: string;        // device-local YYYY-MM-DD
  createdAt: number;
}
```

- [ ] **Step 2: Failing tests for blocks.ts**

`src/domain/blocks.test.ts`:

```ts
import {
  blockMinutesOf, clampBlockMinutes, DEFAULT_BLOCK_MINUTES, formatMinutes, legacyHoursFor,
  parseBlockMinutes, todayCount, todayKey,
} from './blocks';
import { STARTER_CHORES } from './starterChores';
import type { ChoreLog } from './types';

test('every starter chore has a default block', () => {
  for (const c of STARTER_CHORES) expect(DEFAULT_BLOCK_MINUTES[c.name]).toBe(c.blockMinutes);
  expect(DEFAULT_BLOCK_MINUTES['Load the dishwasher']).toBe(15);
  expect(DEFAULT_BLOCK_MINUTES['Cooking']).toBe(45);
});

test('blockMinutesOf prefers the stored value, then the name default, then 15', () => {
  expect(blockMinutesOf({ name: 'Cooking', blockMinutes: 30 })).toBe(30);
  expect(blockMinutesOf({ name: 'Cooking' })).toBe(45);
  expect(blockMinutesOf({ name: 'Vacuum the flat' })).toBe(15);
});

test.each([[0, 5], [3, 5], [7, 5], [8, 10], [62, 60], [500, 240], [Number.NaN, 5]])('clampBlockMinutes(%s) = %s', (i, o) => {
  expect(clampBlockMinutes(i)).toBe(o);
});

test.each([['15', 15], [' 22 ', 20], ['1,5', 5], ['', null], ['abc', null], ['999', 240]])('parseBlockMinutes(%j) = %s', (i, o) => {
  expect(parseBlockMinutes(i)).toBe(o);
});

test('legacyHoursFor estimates a daily chore as weekly hours on the quarter hour, within 0.25–40', () => {
  expect(legacyHoursFor(15)).toBe(1.75); // 15 min × 7 = 105 min = 1.75 h
  expect(legacyHoursFor(5)).toBe(0.5);   // 35 min → 0.58 → 0.5
  expect(legacyHoursFor(240)).toBe(28);
});

test.each([[0, '0 m'], [45, '45 m'], [60, '1 h'], [90, '1 h 30 m'], [195, '3 h 15 m']])('formatMinutes(%s) = %s', (m, s) => {
  expect(formatMinutes(m)).toBe(s);
});

test('todayKey is the local calendar date', () => {
  expect(todayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  expect(todayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
});

test('todayCount counts my logs of a chore today', () => {
  const log = (p: Partial<ChoreLog>): ChoreLog => ({ id: Math.random().toString(36), choreId: 'c1', name: 'x', by: 'a', multiplier: 1, minutes: 15, day: '2026-10-16', createdAt: 1, ...p });
  const logs = [log({}), log({ multiplier: 2 }), log({ by: 'b' }), log({ day: '2026-10-15' }), log({ choreId: 'c2' })];
  expect(todayCount(logs, 'c1', 'a', '2026-10-16')).toBe(2);
});
```

Run: `npx vitest run src/domain/blocks.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement blocks.ts and starter blocks**

`src/domain/blocks.ts`:

```ts
import type { Chore, ChoreLog, MemberId } from './types';

// Typical minutes per occurrence for a 50 m² one-bedroom flat (spec §5.2).
export const DEFAULT_BLOCK_MINUTES: Record<string, number> = {
  'Empty dishes': 10,
  'Load the dishwasher': 15,
  'Load the washing machine': 10,
  'Empty the washing machine': 15,
  'Washing the toilet': 20,
  'Tidy up living room': 15,
  'Tidy up kitchen': 15,
  'Sorting out the groceries': 15,
  'Drying up the toilet': 5,
  'Tidy up the bedroom': 15,
  'Tidy up the hallway': 10,
  'Taking out the trash': 5,
  'Cleaning the fridge': 20,
  'Cooking': 45,
};
export const FALLBACK_BLOCK_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 5;
export const MAX_BLOCK_MINUTES = 240;

export const blockMinutesOf = (c: Pick<Chore, 'name' | 'blockMinutes'>): number =>
  c.blockMinutes ?? DEFAULT_BLOCK_MINUTES[c.name] ?? FALLBACK_BLOCK_MINUTES;

export function clampBlockMinutes(n: number): number {
  if (!Number.isFinite(n)) return MIN_BLOCK_MINUTES;
  return Math.min(MAX_BLOCK_MINUTES, Math.max(MIN_BLOCK_MINUTES, Math.round(n / 5) * 5));
}

export function parseBlockMinutes(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : clampBlockMinutes(n);
}

// Chores still carry the legacy weekly `hours` (required by rules and used by old weeks).
// New chores get an estimate: the block done once a day, on the quarter hour, within 0.25–40.
export const legacyHoursFor = (blockMinutes: number): number =>
  Math.min(40, Math.max(0.25, Math.round(((blockMinutes * 7) / 60) * 4) / 4));

export function formatMinutes(m: number): string {
  const mins = Math.round(m);
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (h === 0) return `${r} m`;
  return r === 0 ? `${h} h` : `${h} h ${r} m`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayCount = (logs: ChoreLog[], choreId: string, by: MemberId, day: string): number =>
  logs.filter((l) => l.choreId === choreId && l.by === by && l.day === day).length;
```

Note: `legacyHoursFor(5)`: 5 × 7 / 60 = 0.583, × 4 = 2.33, rounds to 2, ÷ 4 = 0.5. That matches the test.

In `src/domain/starterChores.ts`, change the type to `{ name: string; hours: number; blockMinutes: number }[]` and add `blockMinutes` to each entry, matching the table in Global Constraints. For example: `{ name: 'Empty dishes', hours: 1, blockMinutes: 10 }`. In `src/domain/starterChores.test.ts`, add:

```ts
test('every starter chore has a block between 5 and 240 in steps of 5', () => {
  for (const c of STARTER_CHORES) {
    expect(c.blockMinutes % 5).toBe(0);
    expect(c.blockMinutes).toBeGreaterThanOrEqual(5);
    expect(c.blockMinutes).toBeLessThanOrEqual(240);
  }
});
```

Run: `npx vitest run src/domain/blocks.test.ts src/domain/starterChores.test.ts`
Expected: PASS.

- [ ] **Step 4: Failing tests for weekSummary.ts**

`src/domain/weekSummary.test.ts`:

```ts
import { blockSlices, memberMinutes, minuteShares, summarizeWeek, weekMode } from './weekSummary';
import type { Chore, ChoreLog, Completion } from './types';

const log = (p: Partial<ChoreLog>): ChoreLog => ({
  id: Math.random().toString(36), choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 1, minutes: 45, day: '2026-10-16', createdAt: 1, ...p,
});
const comp = (p: Partial<Completion>): Completion => ({ choreId: 'c1', percent: 100, name: 'Cooking', hours: 6, assignee: 'a', updatedAt: 1, ...p });
const chores: Chore[] = [
  { id: 'c1', name: 'Cooking', hours: 6, assignee: 'a', createdAt: 0, archivedAt: null },
  { id: 'c2', name: 'Trash', hours: 4, assignee: 'b', createdAt: 1, archivedAt: null },
];

test('weekMode is legacy only when a week has completions and no logs', () => {
  expect(weekMode([], [comp({})])).toBe('legacy');
  expect(weekMode([log({})], [comp({})])).toBe('blocks');
  expect(weekMode([], [])).toBe('blocks');
});

test('memberMinutes credits whoever logged', () => {
  expect(memberMinutes([log({ by: 'a', minutes: 45 }), log({ by: 'b', minutes: 30 }), log({ by: 'b', minutes: 15 })]))
    .toEqual({ a: 45, b: 45, total: 90 });
});

test('minuteShares rounds and sums to 100; zero when nothing logged', () => {
  expect(minuteShares([log({ by: 'a', minutes: 20 }), log({ by: 'b', minutes: 40 })])).toEqual({ a: 33, b: 67 });
  expect(minuteShares([])).toEqual({ a: 0, b: 0 });
});

test('blockSlices groups per person and chore, largest first, a before b, no not-done slice', () => {
  const slices = blockSlices([
    log({ by: 'a', choreId: 'c2', name: 'Trash', minutes: 5 }),
    log({ by: 'a', choreId: 'c1', name: 'Cooking', minutes: 45 }),
    log({ by: 'a', choreId: 'c2', name: 'Trash', minutes: 5 }),
    log({ by: 'b', choreId: 'c1', name: 'Cooking', minutes: 90 }),
  ]);
  expect(slices.map((s) => [s.key, s.label, s.value, s.member, s.shadeIndex, s.shadeCount])).toEqual([
    ['a:c1', 'Cooking', 45, 'a', 0, 2],
    ['a:c2', 'Trash', 10, 'a', 1, 2],
    ['b:c1', 'Cooking', 90, 'b', 0, 1],
  ]);
});

test('summarizeWeek in blocks mode reports minutes and no plan', () => {
  const s = summarizeWeek('2026-W42', chores, [], [log({ by: 'a', minutes: 60 }), log({ by: 'b', minutes: 30 })], true);
  expect(s.mode).toBe('blocks');
  expect(s.done).toEqual({ a: 60, b: 30, total: 90 });
  expect(s.pct).toEqual({ a: 67, b: 33 });
  expect(s.planned).toBeNull();
});

test('summarizeWeek in legacy mode converts hours to minutes and keeps the plan', () => {
  const s = summarizeWeek('2026-W42', chores, [comp({ choreId: 'c1', percent: 50, hours: 6 })], [], true);
  expect(s.mode).toBe('legacy');
  expect(s.done).toEqual({ a: 180, b: 0, total: 180 });
  expect(s.planned).toBe(600);
  expect(s.pct).toEqual({ a: 100, b: 0 });
  expect(s.slices.find((x) => x.key === 'notdone')?.value).toBe(420);
});
```

Run: `npx vitest run src/domain/weekSummary.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 5: Implement weekSummary.ts**

`src/domain/weekSummary.ts`:

```ts
import type { Chore, ChoreLog, Completion, MemberId } from './types';
import { MEMBER_IDS } from './types';
import { choresForWeek, donutSlices, memberHours, sharePercents, type DonutSlice } from './scoring';

export type WeekMode = 'blocks' | 'legacy';

// Weeks rated with percentages before blocks existed keep their old view.
export const weekMode = (logs: ChoreLog[], completions: Completion[]): WeekMode =>
  logs.length === 0 && completions.length > 0 ? 'legacy' : 'blocks';

export function memberMinutes(logs: ChoreLog[]) {
  let a = 0, b = 0;
  for (const l of logs) {
    if (l.by === 'a') a += l.minutes;
    else b += l.minutes;
  }
  return { a, b, total: a + b };
}

export function minuteShares(logs: ChoreLog[]): { a: number; b: number } {
  const { a, total } = memberMinutes(logs);
  if (total === 0) return { a: 0, b: 0 };
  const pa = Math.round((a / total) * 100);
  return { a: pa, b: 100 - pa };
}

export function blockSlices(logs: ChoreLog[]): DonutSlice[] {
  const slices: DonutSlice[] = [];
  for (const m of MEMBER_IDS) {
    const byChore = new Map<string, { label: string; value: number; last: number }>();
    for (const l of logs.filter((x) => x.by === m)) {
      const cur = byChore.get(l.choreId) ?? { label: l.name, value: 0, last: 0 };
      cur.value += l.minutes;
      if (l.createdAt >= cur.last) { cur.label = l.name; cur.last = l.createdAt; }
      byChore.set(l.choreId, cur);
    }
    const mine = [...byChore.entries()].sort((x, y) => y[1].value - x[1].value);
    mine.forEach(([choreId, v], i) =>
      slices.push({ key: `${m}:${choreId}`, label: v.label, value: v.value, member: m as MemberId, shadeIndex: i, shadeCount: mine.length }),
    );
  }
  return slices;
}

export interface WeekSummary {
  mode: WeekMode;
  slices: DonutSlice[];
  pct: { a: number; b: number };
  done: { a: number; b: number; total: number }; // minutes
  planned: number | null;                        // minutes; legacy weeks only
}

export function summarizeWeek(
  weekId: string, chores: Chore[], completions: Completion[], logs: ChoreLog[], isCurrent: boolean,
): WeekSummary {
  if (weekMode(logs, completions) === 'blocks') {
    return { mode: 'blocks', slices: blockSlices(logs), pct: minuteShares(logs), done: memberMinutes(logs), planned: null };
  }
  const views = choresForWeek(weekId, chores, completions, isCurrent);
  const h = memberHours(views);
  const toMin = (hours: number) => Math.round(hours * 60);
  return {
    mode: 'legacy',
    slices: donutSlices(views).map((s) => ({ ...s, value: toMin(s.value) })),
    pct: sharePercents(views),
    done: { a: toMin(h.a), b: toMin(h.b), total: toMin(h.done) },
    planned: toMin(h.total),
  };
}
```

Run: `npx vitest run src/domain/weekSummary.test.ts && npx tsc --noEmit && npm test`
Expected: PASS, and the full suite still green.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: domain for chore time blocks and minute-based week summaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Data layer — rules, repo, hooks, backup

**Files:**
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`, `src/firebase/repo.ts`, `src/firebase/hooks.ts`, `src/domain/backup.ts`, `src/domain/backup.test.ts`

**Interfaces:**
- Consumes: `Chore`, `ChoreLog`, `Multiplier` (Task 1).
- Produces:
  ```ts
  // repo.ts
  export async function addLog(code: string, weekId: string, input: { chore: Pick<Chore, 'id' | 'name'>; by: MemberId; multiplier: Multiplier; blockMinutes: number; day: string }, id?: string): Promise<void>;
  export async function deleteLog(code: string, weekId: string, id: string): Promise<void>;
  export const toLog: (id: string, d: Record<string, unknown>) => ChoreLog;
  export async function updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'blockMinutes' | 'assignee'>>): Promise<void>;
  // addChore's signature changes in Task 5 (Config is its only caller), not here.
  // hooks.ts
  useWeek(code, weekId) → { completions, feedback, logs, loading } // logs newest first
  // backup.ts
  Backup['weeks'][id] = { completions: Completion[]; feedback: Feedback[]; logs?: ChoreLog[] }
  ```
- Removes: `setCompletion`. Check that its only caller was `src/screens/Todo.tsx`, which Task 3 rewrites. To keep this task compiling, Task 2 must not delete `setCompletion` while Todo still imports it, so delete it in Task 3 instead.

- [ ] **Step 1: Failing rules tests**

Append to `tests/rules/firestore.rules.test.ts`, using its existing helpers `authed()` and `h(...)`:

```ts
const logDoc = { choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 2, minutes: 90, day: '2026-10-16', createdAt: 1 };

test('chore logs: valid log accepted, bad multiplier/minutes/day/extra keys rejected, no updates', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l1'), logDoc));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l2'), { ...logDoc, multiplier: 4 }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l3'), { ...logDoc, minutes: 1000 }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l4'), { ...logDoc, minutes: 12.5 }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l5'), { ...logDoc, day: '16/10/2026' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l6'), { ...logDoc, by: 'c' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l7'), { ...logDoc, extra: true }));
  await assertFails(updateDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l1'), { minutes: 15 }));
  await assertSucceeds(deleteDoc(h(authed(), 'weeks', '2026-W42', 'logs', 'l1')));
});

test('chores accept an optional whole-minute blockMinutes between 5 and 240', async () => {
  const base = { name: 'Cooking', hours: 7, assignee: 'a', createdAt: 1, archivedAt: null };
  await assertSucceeds(setDoc(h(authed(), 'chores', 'b1'), { ...base, blockMinutes: 45 }));
  await assertSucceeds(setDoc(h(authed(), 'chores', 'b2'), base));
  await assertFails(setDoc(h(authed(), 'chores', 'b3'), { ...base, blockMinutes: 0 }));
  await assertFails(setDoc(h(authed(), 'chores', 'b4'), { ...base, blockMinutes: 300 }));
  await assertFails(setDoc(h(authed(), 'chores', 'b5'), { ...base, blockMinutes: 7.5 }));
  await assertSucceeds(updateDoc(h(authed(), 'chores', 'b1'), { blockMinutes: 30 }));
});
```

Add `updateDoc` and `deleteDoc` to the `firebase/firestore` import if they're missing.

Run:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
npm run test:rules
```
Expected: the two new tests FAIL; the others pass.

- [ ] **Step 2: Rules**

In `firestore.rules`, add a helper next to `validHours`:

```
    function validBlock(n) { return n is int && n >= 5 && n <= 240; }
```

In `match /chores/{choreId}`, change `hasOnly([... 'archivedAt'])` to include `'blockMinutes'`, and add:

```
          && (!('blockMinutes' in request.resource.data) || validBlock(request.resource.data.blockMinutes))
```

Inside `match /weeks/{weekId}`, after the `feedback` block, add:

```
        match /logs/{logId} {
          allow read, delete: if signedIn();
          allow create: if signedIn()
            && request.resource.data.keys().hasOnly(['choreId', 'name', 'by', 'multiplier', 'minutes', 'day', 'createdAt'])
            && request.resource.data.choreId is string && request.resource.data.choreId.size() > 0 && request.resource.data.choreId.size() <= 100
            && validName(request.resource.data.name, 60)
            && isMember(request.resource.data.by)
            && request.resource.data.multiplier in [1, 2, 3]
            && request.resource.data.minutes is int && request.resource.data.minutes >= 5 && request.resource.data.minutes <= 720
            && request.resource.data.day is string && request.resource.data.day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            && request.resource.data.createdAt is number;
        }
```

Run: `npm run test:rules`
Expected: all pass.

- [ ] **Step 3: Backup validation (test first)**

In `src/domain/backup.test.ts`, add:

```ts
test('accepts optional blockMinutes on chores and optional logs per week', () => {
  const withBlocks = {
    ...good,
    chores: [{ ...good.chores[0], blockMinutes: 45 }],
    weeks: { '2026-W41': { ...good.weeks['2026-W41'], logs: [{ id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 2, minutes: 90, day: '2026-10-08', createdAt: 5 }] } },
  };
  expect(validateBackup(JSON.parse(JSON.stringify(withBlocks))).ok).toBe(true);
});

test.each([
  ['bad blockMinutes', (b: any) => { b.chores[0].blockMinutes = 7; }],
  ['bad log multiplier', (b: any) => { b.weeks['2026-W41'].logs = [{ id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 5, minutes: 90, day: '2026-10-08', createdAt: 5 }]; }],
  ['bad log day', (b: any) => { b.weeks['2026-W41'].logs = [{ id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 1, minutes: 45, day: 'yesterday', createdAt: 5 }]; }],
])('rejects %s', (_l, mutate) => {
  const b = JSON.parse(JSON.stringify(good));
  mutate(b);
  expect(validateBackup(b).ok).toBe(false);
});
```

If `good` in that file is named differently, use its existing valid fixture.

Run: `npx vitest run src/domain/backup.test.ts`
Expected: FAIL.

Then in `src/domain/backup.ts`:
- Change the `weeks` type to `Record<string, { completions: Completion[]; feedback: Feedback[]; logs?: ChoreLog[] }>` (import `ChoreLog`).
- In `validChore`, add `&& (c.blockMinutes === undefined || (Number.isInteger(c.blockMinutes) && (c.blockMinutes as number) >= 5 && (c.blockMinutes as number) <= 240 && (c.blockMinutes as number) % 5 === 0))`.
- Add:
  ```ts
  const validLog = (l: unknown) =>
    isObj(l) && isId(l.id) && isId(l.choreId) && isStr(l.name, 60) && isMember(l.by) &&
    [1, 2, 3].includes(l.multiplier as number) && Number.isInteger(l.minutes) && (l.minutes as number) >= 5 && (l.minutes as number) <= 720 &&
    typeof l.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.day) && isNum(l.createdAt);
  ```
  and in the weeks loop: `if (w.logs !== undefined && (!Array.isArray(w.logs) || !w.logs.every(validLog))) return fail(\`Week ${weekId} has an invalid chore log.\`);`

Use the file's existing helper names (`isObj`, `isId`, `isStr`, `isMember`, `isNum`). Adapt if they differ.

Run: `npx vitest run src/domain/backup.test.ts`
Expected: PASS.

- [ ] **Step 4: Repo and hooks**

In `src/firebase/repo.ts`:
- Imports: add `ChoreLog`, `Multiplier` from `../domain/types`.
- `createHousehold`: each starter chore also writes `blockMinutes: c.blockMinutes`.
- Widen `updateChore`'s patch type to `Partial<Pick<Chore, 'name' | 'hours' | 'blockMinutes' | 'assignee'>>`. Leave `addChore` unchanged here; Task 5 changes it together with its only caller.
- Add after `setFeedbackResolved`:
  ```ts
  /** `id` lets the caller undo before the write is acknowledged (writes resolve only on server ack). */
  export async function addLog(
    code: string, weekId: string,
    input: { chore: Pick<Chore, 'id' | 'name'>; by: MemberId; multiplier: Multiplier; blockMinutes: number; day: string },
    id: string = newId(),
  ) {
    await ensureSignedIn();
    const db = getDb();
    const batch = writeBatch(db);
    batch.set(weekDoc(db, code, weekId), { weekId });
    batch.set(doc(weekDoc(db, code, weekId), 'logs', id), {
      choreId: input.chore.id, name: input.chore.name, by: input.by, multiplier: input.multiplier,
      minutes: input.blockMinutes * input.multiplier, day: input.day, createdAt: Date.now(),
    });
    await track(batch.commit());
  }

  export async function deleteLog(code: string, weekId: string, id: string) {
    await ensureSignedIn();
    await track(deleteDoc(doc(weekDoc(getDb(), code, weekId), 'logs', id)));
  }
  ```
- `toChore`: add `...(typeof d.blockMinutes === 'number' ? { blockMinutes: d.blockMinutes } : {})`.
- Add:
  ```ts
  export const toLog = (id: string, d: Record<string, unknown>): ChoreLog => ({
    id, choreId: d.choreId as string, name: d.name as string, by: d.by as MemberId,
    multiplier: d.multiplier as Multiplier, minutes: d.minutes as number, day: d.day as string, createdAt: d.createdAt as number,
  });
  ```
- `exportHousehold`: also read `collection(w.ref, 'logs')` in the same `Promise.all`, and set `logs: l.docs.map((d) => toLog(d.id, d.data()))` on each week.
- `importHousehold`:
  - Chore data adds `...(c.blockMinutes !== undefined ? { blockMinutes: c.blockMinutes } : {})`.
  - For each week, `for (const l of w.logs ?? []) add(doc(weekDoc(db, code, weekId), 'logs', l.id), { choreId: l.choreId, name: l.name, by: l.by, multiplier: l.multiplier, minutes: l.minutes, day: l.day, createdAt: l.createdAt });`
  - The stale-docs scan loops over `['completions', 'feedback', 'logs']`.

In `src/firebase/hooks.ts` `useWeek`:
- Add `const [logs, setLogs] = useState<ChoreLog[]>([]);` and reset it with the others.
- Add a third listener on `collection(getDb(), ...base, 'logs')` → `setLogs(s.docs.map((d) => toLog(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt))`, with the same `console.error` error callback.
- Unsubscribe it in the cleanup, and return `{ completions, feedback, logs, loading }`.
- Import `toLog` and `ChoreLog`.

Existing component tests that mock `useWeek` without `logs` will get `undefined`. Tasks 3–5 update those screens and their mocks. In this task, run `npx tsc --noEmit && npm test`, and if any test fails only because a mock lacks `logs`, add `logs: []` to that mock.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npm test && npm run test:rules`
Expected: all pass.

```bash
git add firestore.rules tests src
git commit -m "feat: chore logs and block minutes in rules, repo, hooks and backups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ChoreLogger and the To-do screen

**Files:**
- Create: `src/components/ChoreLogger.tsx`, `src/components/ChoreLogger.test.tsx`
- Modify: `src/screens/Todo.tsx`, `src/screens/Todo.test.tsx`, `src/styles.css`, `src/firebase/repo.ts` (remove `setCompletion`)
- Delete: `src/components/SegmentedPercent.tsx`, `src/components/SegmentedPercent.test.tsx`

**Interfaces:**
- Consumes: `useHousehold()`, `addLog`, `deleteLog`, `blockMinutesOf`, `formatMinutes`, `todayKey`, `todayCount`, `MULTIPLIERS`, `ChoreLog`, `other`.
- Produces: `ChoreLogger({ logs }: { logs: ChoreLog[] })`.

- [ ] **Step 1: Failing ChoreLogger tests**

`src/components/ChoreLogger.test.tsx`:

```tsx
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { ChoreLog } from '../domain/types';
import { todayKey } from '../domain/blocks';
import { ChoreLogger } from './ChoreLogger';

const addLog = vi.fn(async () => {});
const deleteLog = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({
  addLog: (...a: unknown[]) => addLog(...(a as [])),
  deleteLog: (...a: unknown[]) => deleteLog(...(a as [])),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [
    { id: 'c1', name: 'Load the dishwasher', hours: 1.5, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Cooking', hours: 7, assignee: 'b', createdAt: 1, archivedAt: null, blockMinutes: 30 },
    { id: 'c3', name: 'Old', hours: 1, assignee: 'a', createdAt: 2, archivedAt: 5 },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
};
const renderIt = (logs: ChoreLog[] = []) =>
  render(<HouseholdContext.Provider value={ctx}><ChoreLogger logs={logs} /></HouseholdContext.Provider>);

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

test('lists active chores, mine first, with block length; archived hidden', () => {
  renderIt();
  const rows = screen.getAllByRole('button', { name: /min/ });
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining('Load the dishwasher'),
    expect.stringContaining('Cooking'),
  ]);
  expect(rows[0]).toHaveTextContent('15 min');
  expect(rows[1]).toHaveTextContent('30 min');
  expect(screen.queryByText('Old')).toBeNull();
  expect(screen.getByText('Yours')).toBeInTheDocument();
  expect(screen.getByText('Tahereh’s')).toBeInTheDocument();
});

test('shows today’s count of my logs per chore', () => {
  const day = todayKey();
  renderIt([
    { id: 'l1', choreId: 'c1', name: 'Load the dishwasher', by: 'a', multiplier: 1, minutes: 15, day, createdAt: 1 },
    { id: 'l2', choreId: 'c1', name: 'Load the dishwasher', by: 'a', multiplier: 2, minutes: 30, day, createdAt: 2 },
    { id: 'l3', choreId: 'c1', name: 'Load the dishwasher', by: 'b', multiplier: 1, minutes: 15, day, createdAt: 3 },
  ]);
  expect(screen.getByRole('button', { name: /Load the dishwasher/ })).toHaveTextContent('✓ 2 today');
});

test('expand, pick 2×, Add logs 30 minutes for me today in the current week', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Load the dishwasher/ }));
  const group = screen.getByRole('radiogroup', { name: 'How many times' });
  expect(within(group).getByRole('radio', { name: '1×' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(within(group).getByRole('radio', { name: '2×' }));
  expect(screen.getByText('= 30 min')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(addLog).toHaveBeenCalledWith(
    'tidy-otter-maple-4821', '2026-W42',
    { chore: { id: 'c1', name: 'Load the dishwasher' }, by: 'a', multiplier: 2, blockMinutes: 15, day: todayKey() },
    expect.any(String),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Logged 30 m · Load the dishwasher');
});

test('Undo deletes the log that was just added', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  const id = (addLog.mock.calls[0] as unknown[])[3];
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(deleteLog).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', id);
  expect(screen.queryByRole('status')).toBeNull();
});

test('the undo toast disappears after 10 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  renderIt();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: /Cooking/ }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByRole('status')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(screen.queryByRole('status')).toBeNull();
});
```

Run: `npx vitest run src/components/ChoreLogger.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement ChoreLogger**

`src/components/ChoreLogger.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { addLog, deleteLog } from '../firebase/repo';
import { blockMinutesOf, formatMinutes, todayCount, todayKey } from '../domain/blocks';
import { MULTIPLIERS, other, type Chore, type ChoreLog, type Multiplier } from '../domain/types';

const UNDO_MS = 10_000;

export function ChoreLogger({ logs }: { logs: ChoreLog[] }) {
  const { code, me, members, chores, currentWeekId } = useHousehold();
  const [open, setOpen] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const day = todayKey();
  const active = chores.filter((c) => c.archivedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  const groups: { title: string; items: Chore[] }[] = [
    { title: 'Yours', items: active.filter((c) => c.assignee === me) },
    { title: `${members[other(me)].name}’s`, items: active.filter((c) => c.assignee !== me) },
  ];

  function toggle(id: string) {
    setOpen((cur) => (cur === id ? null : id));
    setMultiplier(1);
  }

  function add(chore: Chore) {
    const blockMinutes = blockMinutesOf(chore);
    const id = crypto.randomUUID();
    void addLog(code, currentWeekId, { chore: { id: chore.id, name: chore.name }, by: me, multiplier, blockMinutes, day }, id);
    setToast({ id, text: `Logged ${formatMinutes(blockMinutes * multiplier)} · ${chore.name}` });
    setOpen(null);
    setMultiplier(1);
  }

  function undo() {
    if (!toast) return;
    void deleteLog(code, currentWeekId, toast.id);
    setToast(null);
  }

  return (
    <div className="logger">
      {groups.map((g) => g.items.length > 0 && (
        <section key={g.title} className="logger-group">
          <h3 className="logger-title">{g.title}</h3>
          <ul className="cards">
            {g.items.map((c) => {
              const block = blockMinutesOf(c);
              const count = todayCount(logs, c.id, me, day);
              const isOpen = open === c.id;
              return (
                <li key={c.id} className={`card logger-row${isOpen ? ' open' : ''}`}>
                  <button className="logger-head" aria-expanded={isOpen} onClick={() => toggle(c.id)}>
                    <span className="logger-name">{c.name}</span>
                    <span className="muted small">{block} min</span>
                    {count > 0 && <span className="logger-count">✓ {count} today</span>}
                  </button>
                  {isOpen && (
                    <div className="logger-body">
                      <div className="kind-toggle three" role="radiogroup" aria-label="How many times">
                        {MULTIPLIERS.map((m) => (
                          <button key={m} type="button" role="radio" aria-checked={multiplier === m}
                            className={multiplier === m ? 'on plus' : ''} onClick={() => setMultiplier(m)}>{m}×</button>
                        ))}
                      </div>
                      <div className="logger-add">
                        <span className="muted">= {block * multiplier} min</span>
                        <button className="btn primary" onClick={() => add(c)}>Add</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          <button className="btn ghost small" onClick={undo}>Undo</button>
        </div>
      )}
    </div>
  );
}
```

Append to `src/styles.css`:

```css
.logger-title { font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 14px 0 6px; }
.logger-row { padding: 0; }
.logger-head { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 52px; padding: 10px 14px; background: none; border: 0; text-align: start; font: inherit; color: var(--text); cursor: pointer; }
.logger-name { flex: 1; font-weight: 600; }
.logger-count { font-size: .8rem; font-weight: 700; color: var(--accent); white-space: nowrap; }
.logger-body { display: flex; flex-direction: column; gap: 10px; padding: 0 14px 14px; }
.kind-toggle.three { grid-template-columns: repeat(3, 1fr); }
.logger-add { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.logger-add .btn { min-width: 120px; min-height: 44px; }
.toast { position: fixed; left: 16px; right: 16px; bottom: calc(92px + env(safe-area-inset-bottom)); max-width: 528px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--text); color: var(--bg); border-radius: 12px; padding: 8px 8px 8px 14px; box-shadow: 0 6px 20px rgb(0 0 0 / .2); z-index: 20; }
.toast .btn.ghost { color: var(--bg); font-weight: 700; min-height: 44px; }
.logger-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius); }
```

Run: `npx vitest run src/components/ChoreLogger.test.tsx`
Expected: PASS.

- [ ] **Step 3: To-do uses the logger (test first)**

Replace `src/screens/Todo.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Todo } from './Todo';

const setFeedbackResolved = vi.fn();
vi.mock('../firebase/repo', () => ({
  setFeedbackResolved: (...a: unknown[]) => setFeedbackResolved(...a),
  addLog: vi.fn(async () => {}),
  deleteLog: vi.fn(async () => {}),
}));
vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false, completions: [], logs: [],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plate left on sofa', createdAt: 2, resolved: false },
      { id: 'f2', from: 'b', to: 'a', kind: 'plus', text: 'Nice', createdAt: 3, resolved: false },
    ],
  }),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [{ id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null }],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null },
  updateDevice: () => {},
};
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);

test('shows the chore logger instead of percentages', () => {
  renderIt();
  expect(screen.getByRole('heading', { name: 'Log a chore' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cooking/ })).toHaveTextContent('45 min');
  expect(screen.queryByRole('radio', { name: '100' })).toBeNull();
});

test('negative feedback appears as a checkbox task', async () => {
  renderIt();
  expect(screen.queryByText('Nice')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /Plate left on sofa/ }));
  expect(setFeedbackResolved).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', 'f1', true);
});
```

Run: `npx vitest run src/screens/Todo.test.tsx`
Expected: FAIL.

Then edit `src/screens/Todo.tsx`:
- Imports become `useHousehold`, `useWeek`, `setFeedbackResolved` (from repo), `other`, and `ChoreLogger` from `../components/ChoreLogger`.
- Destructure `{ feedback, logs }` from `useWeek`, and drop `completions`, `choresForWeek` and `mine`.
- Replace the "Your chores" `h2` and its list with:
  ```tsx
  <h2>Log a chore</h2>
  <ChoreLogger logs={logs} />
  ```
- The "Feedback to act on" section stays unchanged.

Delete `src/components/SegmentedPercent.tsx` and `src/components/SegmentedPercent.test.tsx`, then confirm with `grep -rn SegmentedPercent src` that nothing references them. Remove `setCompletion` from `src/firebase/repo.ts` after `grep -rn setCompletion src` shows no remaining callers. Drop imports that become unused (`Percent`, `ChoreView`) only if `tsc` reports them.

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat: log chores as 1×/2×/3× time blocks with undo in To-do

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Week view and Home card in minutes

**Files:**
- Modify: `src/screens/Dashboard.tsx`, `src/screens/Dashboard.test.tsx`, `src/screens/Home.tsx`, `src/screens/Home.test.tsx`

**Interfaces:**
- Consumes: `summarizeWeek(weekId, chores, completions, logs, isCurrent)` → `{ mode, slices, pct, done, planned }`; `formatMinutes`; `useWeek` → `{ completions, feedback, logs, loading }`.
- Produces: no new exports.

- [ ] **Step 1: Failing tests**

In `src/screens/Dashboard.test.tsx`, make the `useWeek` mock return values from module-level variables so each test can set them. Use the file's existing fixture names and keep its existing test, which runs in legacy mode because it has completions and no logs:

```tsx
let weekData: { completions: unknown[]; feedback: unknown[]; logs: unknown[] } = { completions: [], feedback: [], logs: [] };
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading: false, ...weekData }) }));
```

Set `weekData` in a `beforeEach` to the existing fixture's completions and feedback, with `logs: []`. Then add:

```tsx
test('blocks week: minutes per person, chore legend in minutes, logged total in the centre', () => {
  weekData = {
    completions: [], feedback: [],
    logs: [
      { id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 2, minutes: 90, day: '2026-10-13', createdAt: 1 },
      { id: 'l2', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 1, minutes: 30, day: '2026-10-14', createdAt: 2 },
    ],
  };
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByTestId('share-a')).toHaveTextContent('75%');
  expect(screen.getByTestId('share-b')).toHaveTextContent('25%');
  expect(screen.getByText('2 h')).toBeInTheDocument();          // centre: 120 minutes logged
  expect(screen.getByText('logged this week')).toBeInTheDocument();
  expect(screen.getByText('1 h 30 m')).toBeInTheDocument();     // Cooking legend
  expect(screen.queryByText(/of /)).toBeNull();                 // no planned total in blocks mode
});

test('legacy week: percent-era week shown as minutes of planned', () => {
  // existing fixture: completions only
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByText(/Rated with percentages/)).toBeInTheDocument();
});
```

Adapt `ctx` to the file's existing context fixture. For the centre text in the blocks case, `formatMinutes(120)` = `2 h`.

In `src/screens/Home.test.tsx`, add `logs` to the hook mock alongside `completions` and `feedback` (module variable, reset in `beforeEach`), and add:

```tsx
test('Tidy Together card uses logged minutes when the week has logs', () => {
  logs = [
    { id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 1, minutes: 45, day: '2026-10-13', createdAt: 1 },
    { id: 'l2', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 3, minutes: 15, day: '2026-10-13', createdAt: 2 },
  ];
  renderHome();
  expect(screen.getByText('You 75% · Tahereh 25%')).toBeInTheDocument();
});
```

Run: `npx vitest run src/screens/Dashboard.test.tsx src/screens/Home.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 2: Dashboard renders from summarizeWeek**

In `src/screens/Dashboard.tsx`:
- Replace the scoring imports (`choresForWeek`, `donutSlices`, `memberHours`, `sharePercents`) with `summarizeWeek` from `../domain/weekSummary` and `formatMinutes` from `../domain/blocks`. Keep `helpfulness`.
- Remove the `h` hours formatter.
- Data:
  ```tsx
  const { completions, feedback, logs } = useWeek(code, weekId);
  const summary = summarizeWeek(weekId, chores, completions, logs, isCurrent);
  const { slices, pct, done, planned, mode } = summary;
  ```
- Donut label:
  ```tsx
  label={done.total === 0
    ? <span className="muted">Nothing logged yet</span>
    : mode === 'blocks'
      ? <><strong>{formatMinutes(done.total)}</strong><span className="muted small">logged this week</span></>
      : <><strong>{formatMinutes(done.total)}</strong><span className="muted small">of {formatMinutes(planned ?? 0)}</span></>}
  ```
- Legend: chore values use `formatMinutes(s.value)`. Each member's footer line is `{formatMinutes(done[m])} logged` in blocks mode, and `{formatMinutes(done[m])} done` in legacy mode. Remove the old per-member "done of X h" planned computation.
- Directly under the week navigation, when `mode === 'legacy'`, render `<p className="muted small">Rated with percentages (before time blocks) — shown as estimated minutes.</p>`.
- The donut `ariaLabel` uses `formatMinutes(done.total)` in place of hours. Keep the rest of its text.

- [ ] **Step 3: Home uses summarizeWeek**

In `src/screens/Home.tsx`:
- Replace `choresForWeek`, `memberHours` and `sharePercents` with `summarizeWeek`.
- Destructure `logs` from `useWeek` too.
- Compute:
  ```tsx
  const { pct, done } = summarizeWeek(currentWeekId, chores, completions, logs, true);
  ```
  and use `done.total === 0` where the code used `done === 0`.

Run: `npx vitest run src/screens && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: weekly chart and Home split in logged minutes; percent weeks stay viewable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Setup edits block minutes

**Files:**
- Modify: `src/screens/Config.tsx`, `src/screens/Config.test.tsx`, `src/firebase/repo.ts` (`addChore`)

**Interfaces:**
- Consumes: `blockMinutesOf`, `parseBlockMinutes`, `legacyHoursFor` from `src/domain/blocks.ts`; `updateChore(code, id, { blockMinutes })`.
- Produces: `addChore(code: string, input: { name: string; blockMinutes: number; assignee: MemberId }): Promise<void>`. It writes `hours = legacyHoursFor(blockMinutes)` so the rules' required `hours` stays valid.
- Removes: `clampHours`, `parseHours` from `Config.tsx`. Check with `grep -rn "parseHours\|clampHours" src` that only Config and its test use them.

- [ ] **Step 1: Update tests first**

In `src/screens/Config.test.tsx`:
- Delete the `clampHours`/`parseHours` `test.each` blocks if present.
- Replace the hours-specific tests ('hours are clamped on blur', 'blurring an emptied hours field reverts and does not write', 'a comma decimal is accepted in a row', 'add form with empty hours…') and update 'lists active chores with per-person totals' and 'adds a chore', as follows. Keep the file's existing fixtures, `renderIt` and mocks. The fixture chores need no `blockMinutes`; defaults come from names, and unknown names give 15.

```tsx
test('lists active chores with block minutes and per-person chore counts', () => {
  renderIt();
  expect(screen.getByDisplayValue('Cooking')).toBeInTheDocument();
  expect(screen.getByLabelText('Minutes per time for Cooking')).toHaveValue('45');
  expect(screen.getByTestId('total-a')).toHaveTextContent('1 chore');
  expect(screen.getByTestId('total-b')).toHaveTextContent('1 chore');
});

test('block minutes are rounded to 5 and clamped on blur', async () => {
  renderIt();
  const input = screen.getByLabelText('Minutes per time for Cooking');
  await userEvent.clear(input);
  await userEvent.type(input, '22');
  await userEvent.tab();
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c1', { blockMinutes: 20 });
  expect(input).toHaveValue('20');
});

test('blurring an emptied block field reverts and does not write', async () => {
  renderIt();
  const input = screen.getByLabelText('Minutes per time for Cooking');
  await userEvent.clear(input);
  await userEvent.tab();
  expect(updateChore).not.toHaveBeenCalled();
  expect(input).toHaveValue('45');
});

test('adds a chore with its block minutes', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('New chore'), 'Vacuum');
  await userEvent.clear(screen.getByLabelText('Minutes per time'));
  await userEvent.type(screen.getByLabelText('Minutes per time'), '25');
  await userEvent.click(screen.getByRole('button', { name: 'Add chore' }));
  expect(addChore).toHaveBeenCalledWith('tidy-otter-maple-4821', { name: 'Vacuum', blockMinutes: 25, assignee: 'a' });
});

test('add form with empty minutes does not add and explains', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('New chore'), 'Vacuum');
  await userEvent.clear(screen.getByLabelText('Minutes per time'));
  await userEvent.click(screen.getByRole('button', { name: 'Add chore' }));
  expect(addChore).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Enter minutes, e.g. 15');
});
```

The fixture's chores must be named so the defaults are known. If its first chore isn't 'Cooking' with id `c1` and assignee `a`, and its second isn't assigned to `b`, adapt the names and ids above to match the existing fixture. Keep the meaning of each test. Rename the label in the 'row inputs are labelled with the chore name' test from `Hours per week for …` to `Minutes per time for …`, and the fallback to `Minutes per time for chore N`.

Run: `npx vitest run src/screens/Config.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

In `src/firebase/repo.ts`, import `legacyHoursFor` from `../domain/blocks` and replace `addChore`:

```ts
export async function addChore(code: string, input: { name: string; blockMinutes: number; assignee: MemberId }) {
  await ensureSignedIn();
  await track(setDoc(doc(choresCol(getDb(), code), newId()), {
    name: input.name, blockMinutes: input.blockMinutes, hours: legacyHoursFor(input.blockMinutes),
    assignee: input.assignee, createdAt: Date.now(), archivedAt: null,
  }));
}
```

In `src/screens/Config.tsx`:
- Import `blockMinutesOf` and `parseBlockMinutes` from `../domain/blocks`. Delete `clampHours`, `parseHours` and `fmt`.
- `ChoreRow`:
  - `hours` state → `block` state initialised `String(blockMinutesOf(chore))`.
  - The resync effect depends on `blockMinutesOf(chore)`.
  - `commitHours` → `commitBlock`: parse with `parseBlockMinutes`; if null, revert to `String(blockMinutesOf(chore))`; otherwise set the field and, if it differs, `updateChore(code, chore.id, { blockMinutes: m })`.
  - The input: class `chore-hours` (keep for layout), `aria-label={chore.name ? \`Minutes per time for ${chore.name}\` : \`Minutes per time for chore ${index + 1}\`}`, `inputMode="numeric"`.
  - Add a visible suffix `<span className="muted small chore-unit">min</span>` right after the input, inside the same grid area as the input. Keep the 44px target and no horizontal scroll at 375px.
- Totals: replace the hours sum with a chore count, `{n} chore{n === 1 ? '' : 's'}`, in `data-testid="total-{m}"`.
- The hint text becomes `Minutes each time it’s done · tap a name to reassign.`
- Add form:
  - The label `Hours per week` becomes `Minutes per time`, default `'15'`, `inputMode="numeric"`.
  - Parse with `parseBlockMinutes`.
  - The error text is `Enter minutes, e.g. 15`.
  - Call `addChore(code, { name: n, blockMinutes: m, assignee })`.

Run: `npx vitest run src/screens/Config.test.tsx && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: chores setup edits minutes per time instead of weekly hours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: README, phone check and deploy (controller)

- [ ] **README.** Replace "How scoring works" with:
  - Each chore has a time block (minutes each time it's done, e.g. dishwasher 15).
  - Logging adds block × 1, 2 or 3.
  - Minutes count for whoever logged them.
  - The weekly chart shows each person's share of logged minutes.
  - Weeks rated with percentages before time blocks still show, as estimated minutes.
  - The helpfulness and feedback bullets stay unchanged.
- [ ] **Phone check.** Against the emulator at 375 × 812, light and dark:
  - Log 1× and 2×, check Undo works, and check the toast clears.
  - The ✓ today count updates.
  - This week shows minutes. A seeded percent-only week shows the legacy note.
  - Home split in minutes.
  - Setup edits minutes.
  - No horizontal scroll.
- [ ] **Deploy rules first:** `npx firebase deploy --only firestore:rules --project responsible-2gether`. The live clients write `blockMinutes` and logs only after the app deploy, so this order is safe.
- [ ] **Then** merge to main, `npm run deploy`, and push.
