# Responsible 2gether Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, installable PWA where a couple tracks weekly chore completion and mutual helpfulness, synced between two phones through Firestore with no login.

**Architecture:** Vite + React + TypeScript single-page app. All scoring rules live in pure, unit-tested modules under `src/domain/`. A thin Firebase layer (`src/firebase/`) handles anonymous auth, Firestore reads (live hooks) and writes (repo functions). React screens consume a `HouseholdContext` that holds the device identity, members and chores.

**Tech Stack:** Vite, React 19, TypeScript, vite-plugin-pwa, Firebase JS SDK (Auth + Firestore), Vitest + React Testing Library + jsdom, `@firebase/rules-unit-testing`, `firebase-tools@13` (emulator; Java 17), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-09-responsible-2gether-design.md`

## Global Constraints

- Repo root: `~/code/responsible-2gether` (branch `main`). All paths below are relative to it.
- Zero running cost: only Firebase Spark (free) and GitHub Pages.
- Exactly two members with ids `'a'` and `'b'`. `a` = teal colour family (hue 174), `b` = coral family (hue 12).
- All stored timestamps are epoch milliseconds (`number`), never Firestore `Timestamp`.
- `weekId` = ISO-8601 week in device local time, format `YYYY-Www` (e.g. `2026-W41`); weeks start Monday 00:00.
- Completion percent ∈ {0, 25, 50, 75, 100}. Chore hours ∈ [0.25, 40]. Chore name 1–60 chars. Member name 1–30 chars. Feedback text 1–280 chars.
- Helpfulness = `max(0, 100 − 10 × minusReceived)`. Ratio warning when `minus > 0 && plus < 2 × minus`.
- Household code = three words from a 64-word list + four digits, e.g. `tidy-otter-maple-4821`; regex `^[a-z]+-[a-z]+-[a-z]+-[0-9]{4}$`.
- Vite `base` = `/responsible-2gether/`.
- Tab order left→right: Configuration | Feedback | Dashboard | To-do | Settings; Dashboard is centre, larger, default.
- Emulator: project id `demo-r2g`, Auth port 9099, Firestore port 8080. Java: `export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH` before any `firebase` command.
- Commits: conventional style (`feat:`, `test:`, `chore:`, `docs:`), each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, vitest.rules.config.ts
index.html, firebase.json, firestore.rules, README.md
.github/workflows/deploy.yml
public/icon.svg (+ generated PNG icons)
src/
  main.tsx                 React entry, registers SW
  App.tsx                  gate: setup-needed / onboarding / who-are-you / shell
  styles.css               tokens (light/dark), layout, components
  test/setup.ts            jest-dom matchers
  domain/                  pure logic, no React, no Firebase
    types.ts               MemberId, Members, Chore, Completion, Feedback, Percent, other()
    week.ts                weekIdOf, weekStart, weekEnd, shiftWeek, formatWeekRange
    scoring.ts             choresForWeek, doneHours, donutSlices, memberHours, sharePercents,
                           helpfulness, feedbackCounts, ratioWarning
    householdCode.ts       WORDS, generateCode, normalizeCode, isValidCode
    starterChores.ts       STARTER_CHORES, starterAssignee
    backup.ts              Backup type, validateBackup
  device.ts                localStorage identity + export reminder
  firebase/
    config.ts              firebaseConfig, useEmulator, isConfigured
    app.ts                 lazy init, ensureSignedIn
    repo.ts                all writes + export/import
    hooks.ts               live read hooks + sync status
  state/HouseholdContext.tsx
  components/              colors.ts, Donut.tsx, HelpBar.tsx, SegmentedPercent.tsx, TabBar.tsx, icons.tsx
  screens/                 SetupNeeded, Onboarding, Dashboard, Todo, Feedback, Config, Settings (.tsx)
tests/rules/firestore.rules.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test/setup.ts`, `src/App.test.tsx`, `public/icon.svg`

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom), `npm run build`, `npm run dev`; `App` default export (replaced in Task 6).

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "responsible-2gether",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:emu": "VITE_USE_EMULATOR=1 vite",
    "emulators": "firebase emulators:start --project demo-r2g",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rules": "firebase emulators:exec --project demo-r2g --only firestore \"vitest run --config vitest.rules.config.ts\"",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
  }
}
```

Then install:
```bash
npm i react react-dom firebase
npm i -D typescript vite @vitejs/plugin-react vite-plugin-pwa @vite-pwa/assets-generator vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/node @firebase/rules-unit-testing firebase-tools@13
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "vite-plugin-pwa/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts", "vitest.rules.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/responsible-2gether/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Responsible 2gether',
        short_name: '2gether',
        description: 'Keep the home tidy, together.',
        theme_color: '#0f766e',
        background_color: '#f7f6f2',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`.gitignore`:
```
node_modules
dist
*.log
.firebase
firestore-debug.log
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="icon" href="/responsible-2gether/favicon.ico" sizes="any" />
    <link rel="icon" href="/responsible-2gether/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/responsible-2gether/apple-touch-icon-180x180.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="2gether" />
    <title>Responsible 2gether</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/icon.svg` (two overlapping hearts/circles in the member colours):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#f7f6f2"/>
  <circle cx="206" cy="256" r="120" fill="#14b8a6" fill-opacity="0.9"/>
  <circle cx="306" cy="256" r="120" fill="#f9735b" fill-opacity="0.85"/>
  <text x="256" y="292" text-anchor="middle" font-family="system-ui, sans-serif" font-size="110" font-weight="800" fill="#ffffff">2</text>
</svg>
```

- [ ] **Step 2: Write the failing smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the app name', () => {
  render(<App />);
  expect(screen.getByText('Responsible 2gether')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./App`.

- [ ] **Step 4: Minimal app**

`src/App.tsx`:
```tsx
export default function App() {
  return <h1>Responsible 2gether</h1>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/styles.css` (tokens; screens add classes in later tasks):
```css
:root {
  --bg: #f7f6f2;
  --surface: #ffffff;
  --text: #1c1b19;
  --muted: #6b6860;
  --border: #e4e1d8;
  --accent: #0f766e;
  --danger: #c2410c;
  --warn-bg: #fff4e5;
  --warn-text: #8a4b00;
  --slice-empty: #dedad0;
  --radius: 14px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151513;
    --surface: #201f1c;
    --text: #f1efe9;
    --muted: #a19d93;
    --border: #34322d;
    --accent: #2dd4bf;
    --danger: #fb923c;
    --warn-bg: #3a2a12;
    --warn-text: #fcd38d;
    --slice-empty: #3a3833;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
button, input, select { font: inherit; color: inherit; }
```

- [ ] **Step 5: Generate icons and verify test + build pass**

Run: `npm run icons && npm test && npm run build`
Expected: icons written to `public/` (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`); 1 test passes; `dist/` contains `manifest.webmanifest` and `sw.js`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS PWA with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domain types and ISO weeks

**Files:**
- Create: `src/domain/types.ts`, `src/domain/week.ts`
- Test: `src/domain/week.test.ts`

**Interfaces:**
- Produces:
  - `type MemberId = 'a' | 'b'`; `MEMBER_IDS: MemberId[]`; `other(m: MemberId): MemberId`
  - `type Percent = 0 | 25 | 50 | 75 | 100`; `PERCENTS: Percent[]`
  - `interface Members { a: { name: string }; b: { name: string } }`
  - `interface Chore { id: string; name: string; hours: number; assignee: MemberId; createdAt: number; archivedAt: number | null }`
  - `interface Completion { choreId: string; percent: Percent; name: string; hours: number; assignee: MemberId; updatedAt: number }`
  - `type FeedbackKind = 'plus' | 'minus'`
  - `interface Feedback { id: string; from: MemberId; to: MemberId; kind: FeedbackKind; text: string; createdAt: number; resolved: boolean }`
  - `weekIdOf(d: Date): string`, `weekStart(weekId: string): Date`, `weekEnd(weekId: string): Date` (exclusive, next Monday 00:00), `shiftWeek(weekId: string, delta: number): string`, `formatWeekRange(weekId: string): string`

- [ ] **Step 1: Write types**

`src/domain/types.ts`:
```ts
export type MemberId = 'a' | 'b';
export const MEMBER_IDS: MemberId[] = ['a', 'b'];
export const other = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a');

export type Percent = 0 | 25 | 50 | 75 | 100;
export const PERCENTS: Percent[] = [0, 25, 50, 75, 100];

export interface Members {
  a: { name: string };
  b: { name: string };
}

export interface Chore {
  id: string;
  name: string;
  hours: number;
  assignee: MemberId;
  createdAt: number;
  archivedAt: number | null;
}

export interface Completion {
  choreId: string;
  percent: Percent;
  name: string;
  hours: number;
  assignee: MemberId;
  updatedAt: number;
}

export type FeedbackKind = 'plus' | 'minus';

export interface Feedback {
  id: string;
  from: MemberId;
  to: MemberId;
  kind: FeedbackKind;
  text: string;
  createdAt: number;
  resolved: boolean;
}
```

- [ ] **Step 2: Write the failing week tests**

`src/domain/week.test.ts`:
```ts
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/domain/week.test.ts`
Expected: FAIL — cannot resolve `./week`.

- [ ] **Step 4: Implement**

`src/domain/week.ts`:
```ts
const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7; // Mon=0 … Sun=6

function week1Monday(isoYear: number): Date {
  const jan4 = new Date(isoYear, 0, 4);
  return new Date(isoYear, 0, 4 - mondayIndex(jan4));
}

export function weekIdOf(d: Date): string {
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d) + 3);
  const isoYear = thursday.getFullYear();
  const days = Math.round((thursday.getTime() - week1Monday(isoYear).getTime()) / DAY);
  const week = Math.floor(days / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function parse(weekId: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`Bad weekId: ${weekId}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

export function weekStart(weekId: string): Date {
  const { year, week } = parse(weekId);
  const w1 = week1Monday(year);
  return new Date(w1.getFullYear(), w1.getMonth(), w1.getDate() + (week - 1) * 7);
}

export function weekEnd(weekId: string): Date {
  const s = weekStart(weekId);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
}

export function shiftWeek(weekId: string, delta: number): string {
  const s = weekStart(weekId);
  return weekIdOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * delta + 3));
}

export function formatWeekRange(weekId: string): string {
  const s = weekStart(weekId);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  const sYear = s.getFullYear() === e.getFullYear() ? '' : ` ${s.getFullYear()}`;
  return `${s.getDate()} ${MONTHS[s.getMonth()]}${sYear} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/domain/week.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: domain types and ISO week helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scoring rules

**Files:**
- Create: `src/domain/scoring.ts`
- Test: `src/domain/scoring.test.ts`

**Interfaces:**
- Consumes: types from `src/domain/types.ts`; `weekStart`, `weekEnd` from `src/domain/week.ts`.
- Produces:
  - `interface ChoreView { choreId: string; name: string; hours: number; assignee: MemberId; percent: Percent }`
  - `choresForWeek(weekId: string, chores: Chore[], completions: Completion[], isCurrent: boolean): ChoreView[]` (ordered by chore `createdAt`)
  - `doneHours(v: ChoreView): number`
  - `interface DonutSlice { key: string; label: string; value: number; member: MemberId | null; shadeIndex: number; shadeCount: number }`
  - `donutSlices(views: ChoreView[]): DonutSlice[]`
  - `memberHours(views: ChoreView[]): { a: number; b: number; done: number; total: number }`
  - `sharePercents(views: ChoreView[]): { a: number; b: number }`
  - `helpfulness(feedback: Feedback[], member: MemberId): number`
  - `feedbackCounts(feedback: Feedback[], giver: MemberId): { plus: number; minus: number }`
  - `ratioWarning(plus: number, minus: number): boolean`

- [ ] **Step 1: Write failing tests**

`src/domain/scoring.test.ts`:
```ts
import {
  choresForWeek, doneHours, donutSlices, memberHours, sharePercents,
  helpfulness, feedbackCounts, ratioWarning, type ChoreView,
} from './scoring';
import type { Chore, Completion, Feedback } from './types';

const W = '2026-W41'; // Mon 5 Oct – Sun 11 Oct 2026
const t = (m: number, d: number) => new Date(2026, m - 1, d, 12).getTime();

const chore = (p: Partial<Chore> & { id: string }): Chore => ({
  name: p.id, hours: 1, assignee: 'a', createdAt: t(1, 1), archivedAt: null, ...p,
});
const comp = (p: Partial<Completion> & { choreId: string }): Completion => ({
  percent: 100, name: p.choreId, hours: 1, assignee: 'a', updatedAt: t(10, 6), ...p,
});
const fb = (p: Partial<Feedback>): Feedback => ({
  id: Math.random().toString(36), from: 'a', to: 'b', kind: 'plus', text: 'x',
  createdAt: t(10, 6), resolved: false, ...p,
});

describe('choresForWeek', () => {
  test('excludes chores created after the week and archived before it', () => {
    const chores = [
      chore({ id: 'old-archived', archivedAt: t(9, 1) }),
      chore({ id: 'future', createdAt: t(10, 20) }),
      chore({ id: 'archived-midweek', archivedAt: t(10, 7) }),
      chore({ id: 'live' }),
    ];
    expect(choresForWeek(W, chores, [], true).map((v) => v.choreId)).toEqual(['archived-midweek', 'live']);
  });

  test('unrated chores are 0%', () => {
    expect(choresForWeek(W, [chore({ id: 'x' })], [], true)[0].percent).toBe(0);
  });

  test('current week uses live chore data', () => {
    const v = choresForWeek(W, [chore({ id: 'x', hours: 3, name: 'New' })], [comp({ choreId: 'x', hours: 1, name: 'Old', percent: 50 })], true)[0];
    expect(v).toEqual({ choreId: 'x', name: 'New', hours: 3, assignee: 'a', percent: 50 });
  });

  test('past week uses completion snapshot', () => {
    const v = choresForWeek(W, [chore({ id: 'x', hours: 3, name: 'New', assignee: 'b' })], [comp({ choreId: 'x', hours: 1, name: 'Old', assignee: 'a', percent: 50 })], false)[0];
    expect(v).toEqual({ choreId: 'x', name: 'Old', hours: 1, assignee: 'a', percent: 50 });
  });

  test('orders by createdAt', () => {
    const chores = [chore({ id: 'second', createdAt: t(2, 1) }), chore({ id: 'first', createdAt: t(1, 1) })];
    expect(choresForWeek(W, chores, [], true).map((v) => v.choreId)).toEqual(['first', 'second']);
  });
});

const v = (p: Partial<ChoreView> & { choreId: string }): ChoreView => ({
  name: p.choreId, hours: 1, assignee: 'a', percent: 0, ...p,
});

test('doneHours', () => {
  expect(doneHours(v({ choreId: 'x', hours: 2, percent: 75 }))).toBe(1.5);
});

describe('donutSlices', () => {
  test('groups by member (a first), largest first, then a not-done slice', () => {
    const slices = donutSlices([
      v({ choreId: 'b1', assignee: 'b', hours: 2, percent: 100 }),
      v({ choreId: 'a1', assignee: 'a', hours: 1, percent: 100 }),
      v({ choreId: 'a2', assignee: 'a', hours: 4, percent: 50 }),
      v({ choreId: 'a3', assignee: 'a', hours: 1, percent: 0 }),
    ]);
    expect(slices.map((s) => [s.key, s.value, s.member, s.shadeIndex, s.shadeCount])).toEqual([
      ['a2', 2, 'a', 0, 2],
      ['a1', 1, 'a', 1, 2],
      ['b1', 2, 'b', 0, 1],
      ['notdone', 3, null, 0, 1],
    ]);
  });

  test('no not-done slice when everything is complete', () => {
    expect(donutSlices([v({ choreId: 'a1', percent: 100 })]).map((s) => s.key)).toEqual(['a1']);
  });
});

test('memberHours', () => {
  expect(memberHours([
    v({ choreId: 'a1', assignee: 'a', hours: 2, percent: 50 }),
    v({ choreId: 'b1', assignee: 'b', hours: 4, percent: 75 }),
  ])).toEqual({ a: 1, b: 3, done: 4, total: 6 });
});

describe('sharePercents', () => {
  test('splits done hours and sums to 100', () => {
    expect(sharePercents([
      v({ choreId: 'a1', assignee: 'a', hours: 1, percent: 100 }),
      v({ choreId: 'b1', assignee: 'b', hours: 2, percent: 100 }),
    ])).toEqual({ a: 33, b: 67 });
  });
  test('nothing done', () => {
    expect(sharePercents([v({ choreId: 'a1' })])).toEqual({ a: 0, b: 0 });
  });
});

describe('helpfulness', () => {
  test('starts at 100, minus 10 per negative received, plus ignored', () => {
    const list = [fb({ to: 'b', kind: 'minus' }), fb({ to: 'b', kind: 'minus' }), fb({ to: 'b', kind: 'plus' }), fb({ from: 'b', to: 'a', kind: 'minus' })];
    expect(helpfulness(list, 'b')).toBe(80);
    expect(helpfulness(list, 'a')).toBe(90);
  });
  test('resolved negatives still count', () => {
    expect(helpfulness([fb({ to: 'b', kind: 'minus', resolved: true })], 'b')).toBe(90);
  });
  test('floors at 0', () => {
    expect(helpfulness(Array.from({ length: 12 }, () => fb({ to: 'b', kind: 'minus' })), 'b')).toBe(0);
  });
});

test('feedbackCounts counts only what the giver gave', () => {
  const list = [fb({ from: 'a', kind: 'plus' }), fb({ from: 'a', kind: 'minus' }), fb({ from: 'b', to: 'a', kind: 'minus' })];
  expect(feedbackCounts(list, 'a')).toEqual({ plus: 1, minus: 1 });
});

describe('ratioWarning', () => {
  test.each([
    [0, 0, false],
    [0, 1, true],
    [2, 1, false],
    [9, 5, true],
    [10, 5, false],
    [20, 0, false],
  ])('plus=%i minus=%i → %s', (plus, minus, expected) => {
    expect(ratioWarning(plus, minus)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement**

`src/domain/scoring.ts`:
```ts
import type { Chore, Completion, Feedback, MemberId, Percent } from './types';
import { MEMBER_IDS } from './types';
import { weekEnd, weekStart } from './week';

export interface ChoreView {
  choreId: string;
  name: string;
  hours: number;
  assignee: MemberId;
  percent: Percent;
}

export function choresForWeek(
  weekId: string,
  chores: Chore[],
  completions: Completion[],
  isCurrent: boolean,
): ChoreView[] {
  const start = weekStart(weekId).getTime();
  const end = weekEnd(weekId).getTime();
  const byId = new Map(completions.map((c) => [c.choreId, c]));
  return chores
    .filter((c) => c.createdAt < end && (c.archivedAt === null || c.archivedAt >= start))
    .sort((x, y) => x.createdAt - y.createdAt)
    .map((c) => {
      const done = byId.get(c.id);
      const src = !isCurrent && done ? done : c;
      return { choreId: c.id, name: src.name, hours: src.hours, assignee: src.assignee, percent: done?.percent ?? 0 };
    });
}

export const doneHours = (v: ChoreView) => (v.hours * v.percent) / 100;

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  member: MemberId | null;
  shadeIndex: number;
  shadeCount: number;
}

export function donutSlices(views: ChoreView[]): DonutSlice[] {
  const slices: DonutSlice[] = [];
  for (const m of MEMBER_IDS) {
    const mine = views
      .filter((v) => v.assignee === m && doneHours(v) > 0)
      .sort((x, y) => doneHours(y) - doneHours(x));
    mine.forEach((v, i) =>
      slices.push({ key: v.choreId, label: v.name, value: doneHours(v), member: m, shadeIndex: i, shadeCount: mine.length }),
    );
  }
  const { done, total } = memberHours(views);
  if (total - done > 0) {
    slices.push({ key: 'notdone', label: 'Not done yet', value: total - done, member: null, shadeIndex: 0, shadeCount: 1 });
  }
  return slices;
}

export function memberHours(views: ChoreView[]) {
  let a = 0, b = 0, total = 0;
  for (const v of views) {
    total += v.hours;
    if (v.assignee === 'a') a += doneHours(v);
    else b += doneHours(v);
  }
  return { a, b, done: a + b, total };
}

export function sharePercents(views: ChoreView[]): { a: number; b: number } {
  const { a, done } = memberHours(views);
  if (done === 0) return { a: 0, b: 0 };
  const pa = Math.round((a / done) * 100);
  return { a: pa, b: 100 - pa };
}

export function helpfulness(feedback: Feedback[], member: MemberId): number {
  const minus = feedback.filter((f) => f.to === member && f.kind === 'minus').length;
  return Math.max(0, 100 - 10 * minus);
}

export function feedbackCounts(feedback: Feedback[], giver: MemberId) {
  const mine = feedback.filter((f) => f.from === giver);
  return {
    plus: mine.filter((f) => f.kind === 'plus').length,
    minus: mine.filter((f) => f.kind === 'minus').length,
  };
}

export const ratioWarning = (plus: number, minus: number) => minus > 0 && plus < 2 * minus;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: scoring rules for donut, shares, helpfulness and feedback ratio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Household code, starter chores, backup validation, device storage

**Files:**
- Create: `src/domain/householdCode.ts`, `src/domain/starterChores.ts`, `src/domain/backup.ts`, `src/device.ts`
- Test: `src/domain/householdCode.test.ts`, `src/domain/starterChores.test.ts`, `src/domain/backup.test.ts`, `src/device.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  - `WORDS: string[]` (64), `generateCode(randomInt?: (n: number) => number): string`, `normalizeCode(input: string): string`, `isValidCode(s: string): boolean`
  - `STARTER_CHORES: { name: string; hours: number }[]`, `starterAssignee(index: number): MemberId`
  - `interface Backup { version: 1; exportedAt: number; code: string; members: Members; chores: Chore[]; weeks: Record<string, { completions: Completion[]; feedback: Feedback[] }> }`, `validateBackup(x: unknown): { ok: true; backup: Backup } | { ok: false; error: string }`
  - `interface DeviceState { code: string | null; me: MemberId | null; lastExportAt: number | null }`, `EMPTY_DEVICE: DeviceState`, `loadDevice(storage?: Storage): DeviceState`, `saveDevice(s: DeviceState, storage?: Storage): void`, `exportReminderDue(lastExportAt: number | null, now: number): boolean`

- [ ] **Step 1: Write failing tests**

`src/domain/householdCode.test.ts`:
```ts
import { WORDS, generateCode, normalizeCode, isValidCode } from './householdCode';

test('word list has 64 unique lowercase words', () => {
  expect(WORDS).toHaveLength(64);
  expect(new Set(WORDS).size).toBe(64);
  WORDS.forEach((w) => expect(w).toMatch(/^[a-z]+$/));
});

test('generateCode uses three words and four digits', () => {
  const seq = [0, 1, 2, 4821];
  let i = 0;
  expect(generateCode(() => seq[i++])).toBe(`${WORDS[0]}-${WORDS[1]}-${WORDS[2]}-4821`);
});

test('generateCode pads digits', () => {
  const seq = [0, 0, 0, 7];
  let i = 0;
  expect(generateCode(() => seq[i++])).toMatch(/-0007$/);
});

test('default generator produces valid codes', () => {
  for (let i = 0; i < 50; i++) expect(isValidCode(generateCode())).toBe(true);
});

test('normalizeCode trims, lowercases and turns spaces into dashes', () => {
  expect(normalizeCode('  Tidy Otter  MAPLE 4821 ')).toBe('tidy-otter-maple-4821');
});

test.each([
  ['tidy-otter-maple-4821', true],
  ['tidy-otter-4821', false],
  ['tidy-otter-maple-482', false],
  ['Tidy-otter-maple-4821', false],
  ['tidy/otter-maple-4821', false],
])('isValidCode(%s) = %s', (s, ok) => expect(isValidCode(s)).toBe(ok));
```

`src/domain/starterChores.test.ts`:
```ts
import { STARTER_CHORES, starterAssignee } from './starterChores';

test('14 starter chores in the agreed order', () => {
  expect(STARTER_CHORES.map((c) => c.name)).toEqual([
    'Empty dishes', 'Load the dishwasher', 'Load the washing machine', 'Empty the washing machine',
    'Washing the toilet', 'Tidy up living room', 'Tidy up kitchen', 'Sorting out the groceries',
    'Drying up the toilet', 'Tidy up the bedroom', 'Tidy up the hallway', 'Taking out the trash',
    'Cleaning the fridge', 'Cooking',
  ]);
});

test('total is 17.25 hours', () => {
  expect(STARTER_CHORES.reduce((s, c) => s + c.hours, 0)).toBe(17.25);
});

test('assignees alternate starting with a', () => {
  expect([0, 1, 2, 3].map(starterAssignee)).toEqual(['a', 'b', 'a', 'b']);
});
```

`src/domain/backup.test.ts`:
```ts
import { validateBackup, type Backup } from './backup';

const good: Backup = {
  version: 1,
  exportedAt: 1,
  code: 'tidy-otter-maple-4821',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [{ id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 1, archivedAt: null }],
  weeks: {
    '2026-W41': {
      completions: [{ choreId: 'c1', percent: 50, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 2 }],
      feedback: [{ id: 'f1', from: 'a', to: 'b', kind: 'plus', text: 'Thanks', createdAt: 3, resolved: false }],
    },
  },
};

test('accepts a valid backup', () => {
  expect(validateBackup(JSON.parse(JSON.stringify(good)))).toEqual({ ok: true, backup: good });
});

test.each([
  ['not an object', 42],
  ['wrong version', { ...good, version: 2 }],
  ['bad code', { ...good, code: 'nope' }],
  ['missing member name', { ...good, members: { a: { name: '' }, b: { name: 'Sam' } } }],
  ['bad chore assignee', { ...good, chores: [{ ...good.chores[0], assignee: 'c' }] }],
  ['bad week id', { ...good, weeks: { 'week-41': good.weeks['2026-W41'] } }],
  ['bad percent', { ...good, weeks: { '2026-W41': { ...good.weeks['2026-W41'], completions: [{ ...good.weeks['2026-W41'].completions[0], percent: 30 }] } } }],
  ['bad feedback kind', { ...good, weeks: { '2026-W41': { ...good.weeks['2026-W41'], feedback: [{ ...good.weeks['2026-W41'].feedback[0], kind: 'meh' }] } } }],
])('rejects %s', (_label, input) => {
  const r = validateBackup(input);
  expect(r.ok).toBe(false);
});
```

`src/device.test.ts`:
```ts
import { loadDevice, saveDevice, exportReminderDue, EMPTY_DEVICE } from './device';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

test('empty storage gives empty device', () => {
  expect(loadDevice(memoryStorage())).toEqual(EMPTY_DEVICE);
});

test('round-trips', () => {
  const s = memoryStorage();
  saveDevice({ code: 'tidy-otter-maple-4821', me: 'b', lastExportAt: 5 }, s);
  expect(loadDevice(s)).toEqual({ code: 'tidy-otter-maple-4821', me: 'b', lastExportAt: 5 });
});

test('corrupt JSON gives empty device', () => {
  const s = memoryStorage();
  s.setItem('r2g.device', '{nope');
  expect(loadDevice(s)).toEqual(EMPTY_DEVICE);
});

test('throwing storage gives empty device and save does not throw', () => {
  const s = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(loadDevice(s)).toEqual(EMPTY_DEVICE);
  expect(() => saveDevice(EMPTY_DEVICE, s)).not.toThrow();
});

describe('exportReminderDue', () => {
  const DAY = 86_400_000;
  test('never exported', () => expect(exportReminderDue(null, 0)).toBe(true));
  test('29 days ago', () => expect(exportReminderDue(0, 29 * DAY)).toBe(false));
  test('31 days ago', () => expect(exportReminderDue(0, 31 * DAY)).toBe(true));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/domain src/device.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/domain/householdCode.ts`:
```ts
export const WORDS = [
  'apple', 'amber', 'basil', 'berry', 'birch', 'brook', 'cedar', 'cherry',
  'clover', 'coral', 'cotton', 'daisy', 'dune', 'ember', 'fern', 'fig',
  'finch', 'flint', 'frost', 'gecko', 'ginger', 'harbor', 'hazel', 'heron',
  'honey', 'iris', 'ivy', 'jade', 'juniper', 'kiwi', 'lark', 'lemon',
  'lilac', 'linen', 'lotus', 'maple', 'meadow', 'mint', 'moss', 'nectar',
  'olive', 'orchid', 'otter', 'pebble', 'pepper', 'pine', 'plum', 'poppy',
  'quartz', 'raven', 'reed', 'river', 'robin', 'sage', 'sparrow', 'spruce',
  'tidy', 'tulip', 'velvet', 'willow', 'wren', 'yarrow', 'zinnia', 'cocoa',
];

const cryptoInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

export function generateCode(randomInt: (n: number) => number = cryptoInt): string {
  const words = [0, 1, 2].map(() => WORDS[randomInt(WORDS.length)]);
  const digits = String(randomInt(10_000)).padStart(4, '0');
  return [...words, digits].join('-');
}

export const normalizeCode = (input: string) =>
  input.trim().toLowerCase().split(/[\s-]+/).filter(Boolean).join('-');

export const isValidCode = (s: string) => /^[a-z]+-[a-z]+-[a-z]+-[0-9]{4}$/.test(s);
```

`src/domain/starterChores.ts`:
```ts
import type { MemberId } from './types';

// Weekly hours for a 50 m² one-bedroom flat shared by two.
export const STARTER_CHORES: { name: string; hours: number }[] = [
  { name: 'Empty dishes', hours: 1 },
  { name: 'Load the dishwasher', hours: 1.5 },
  { name: 'Load the washing machine', hours: 0.5 },
  { name: 'Empty the washing machine', hours: 1 },
  { name: 'Washing the toilet', hours: 1 },
  { name: 'Tidy up living room', hours: 1 },
  { name: 'Tidy up kitchen', hours: 1.5 },
  { name: 'Sorting out the groceries', hours: 0.5 },
  { name: 'Drying up the toilet', hours: 0.5 },
  { name: 'Tidy up the bedroom', hours: 0.75 },
  { name: 'Tidy up the hallway', hours: 0.25 },
  { name: 'Taking out the trash', hours: 0.5 },
  { name: 'Cleaning the fridge', hours: 0.25 },
  { name: 'Cooking', hours: 7 },
];

export const starterAssignee = (index: number): MemberId => (index % 2 === 0 ? 'a' : 'b');
```

`src/domain/backup.ts`:
```ts
import type { Chore, Completion, Feedback, Members } from './types';
import { PERCENTS } from './types';
import { isValidCode } from './householdCode';

export interface Backup {
  version: 1;
  exportedAt: number;
  code: string;
  members: Members;
  chores: Chore[];
  weeks: Record<string, { completions: Completion[]; feedback: Feedback[] }>;
}

type R = { ok: true; backup: Backup } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max;
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const isMember = (x: unknown) => x === 'a' || x === 'b';
const isHours = (x: unknown) => isNum(x) && (x as number) >= 0.25 && (x as number) <= 40;

const validChore = (c: unknown) =>
  isObj(c) && isStr(c.id, 100) && isStr(c.name, 60) && isHours(c.hours) && isMember(c.assignee) &&
  isNum(c.createdAt) && (c.archivedAt === null || isNum(c.archivedAt));

const validCompletion = (c: unknown) =>
  isObj(c) && isStr(c.choreId, 100) && PERCENTS.includes(c.percent as never) && isStr(c.name, 60) &&
  isHours(c.hours) && isMember(c.assignee) && isNum(c.updatedAt);

const validFeedback = (f: unknown) =>
  isObj(f) && isStr(f.id, 100) && isMember(f.from) && isMember(f.to) && f.from !== f.to &&
  (f.kind === 'plus' || f.kind === 'minus') && isStr(f.text, 280) && isNum(f.createdAt) &&
  typeof f.resolved === 'boolean';

export function validateBackup(x: unknown): R {
  const fail = (error: string): R => ({ ok: false, error });
  if (!isObj(x)) return fail('Not a backup file.');
  if (x.version !== 1) return fail('Unsupported backup version.');
  if (typeof x.code !== 'string' || !isValidCode(x.code)) return fail('Backup has an invalid household code.');
  if (!isNum(x.exportedAt)) return fail('Backup is missing its export date.');
  const m = x.members;
  if (!isObj(m) || !isObj(m.a) || !isObj(m.b) || !isStr(m.a.name, 30) || !isStr(m.b.name, 30)) return fail('Backup has invalid member names.');
  if (!Array.isArray(x.chores) || !x.chores.every(validChore)) return fail('Backup has an invalid chore.');
  if (!isObj(x.weeks)) return fail('Backup is missing weeks.');
  for (const [weekId, w] of Object.entries(x.weeks)) {
    if (!/^\d{4}-W\d{2}$/.test(weekId)) return fail(`Invalid week "${weekId}".`);
    if (!isObj(w) || !Array.isArray(w.completions) || !Array.isArray(w.feedback)) return fail(`Week ${weekId} is malformed.`);
    if (!w.completions.every(validCompletion)) return fail(`Week ${weekId} has an invalid completion.`);
    if (!w.feedback.every(validFeedback)) return fail(`Week ${weekId} has invalid feedback.`);
  }
  return { ok: true, backup: x as unknown as Backup };
}
```

`src/device.ts`:
```ts
import type { MemberId } from './domain/types';

export interface DeviceState {
  code: string | null;
  me: MemberId | null;
  lastExportAt: number | null;
}

export const EMPTY_DEVICE: DeviceState = { code: null, me: null, lastExportAt: null };
const KEY = 'r2g.device';
const DAY = 86_400_000;

export function loadDevice(storage: Storage = localStorage): DeviceState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_DEVICE;
    const p = JSON.parse(raw);
    return {
      code: typeof p.code === 'string' ? p.code : null,
      me: p.me === 'a' || p.me === 'b' ? p.me : null,
      lastExportAt: typeof p.lastExportAt === 'number' ? p.lastExportAt : null,
    };
  } catch {
    return EMPTY_DEVICE;
  }
}

export function saveDevice(s: DeviceState, storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked (private mode); identity lasts for this session only.
  }
}

export const exportReminderDue = (lastExportAt: number | null, now: number) =>
  lastExportAt === null || now - lastExportAt > 30 * DAY;
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: household codes, starter chores, backup validation, device identity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Firebase layer and security rules

**Files:**
- Create: `firebase.json`, `firestore.rules`, `vitest.rules.config.ts`, `tests/rules/firestore.rules.test.ts`, `src/firebase/config.ts`, `src/firebase/app.ts`, `src/firebase/repo.ts`, `src/firebase/hooks.ts`

**Interfaces:**
- Consumes: domain types, `Backup`, `STARTER_CHORES`, `starterAssignee`, `ChoreView`.
- Produces (`src/firebase/config.ts`): `firebaseConfig`, `useEmulator: boolean`, `isConfigured: boolean`
- Produces (`src/firebase/app.ts`): `getDb(): Firestore`, `ensureSignedIn(): Promise<void>`
- Produces (`src/firebase/repo.ts`):
  - `householdExists(code: string): Promise<boolean>`
  - `createHousehold(code: string, members: Members): Promise<void>` (writes household + starter chores)
  - `updateMembers(code: string, members: Members): Promise<void>`
  - `addChore(code: string, input: { name: string; hours: number; assignee: MemberId }): Promise<void>`
  - `updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'assignee'>>): Promise<void>`
  - `archiveChore(code: string, id: string): Promise<void>`
  - `setCompletion(code: string, weekId: string, view: ChoreView, percent: Percent): Promise<void>`
  - `addFeedback(code: string, weekId: string, input: { from: MemberId; kind: FeedbackKind; text: string }): Promise<void>`
  - `deleteFeedback(code: string, weekId: string, id: string): Promise<void>`
  - `setFeedbackResolved(code: string, weekId: string, id: string, resolved: boolean): Promise<void>`
  - `exportHousehold(code: string): Promise<Backup>`
  - `importHousehold(code: string, backup: Backup): Promise<void>` (replaces everything under `code`)
- Produces (`src/firebase/hooks.ts`):
  - `useHouseholdDoc(code: string): { members: Members | null; loading: boolean }`
  - `useChores(code: string): Chore[]` (includes archived)
  - `useWeek(code: string, weekId: string): { completions: Completion[]; feedback: Feedback[]; loading: boolean }`
  - `type SyncStatus = 'synced' | 'saving' | 'offline'`; `useSyncStatus(code: string): SyncStatus`

Repo writes are fire-and-forget friendly: Firestore resolves writes only on server ack, so UI code must NOT `await` them for responsiveness (except create/join/import/export which need the server).

- [ ] **Step 1: Emulator config and rules**

`firebase.json`:
```json
{
  "firestore": { "rules": "firestore.rules" },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

`firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isMember(m) { return m == 'a' || m == 'b'; }
    function validName(s, max) { return s is string && s.size() > 0 && s.size() <= max; }
    function validHours(h) { return h is number && h >= 0.25 && h <= 40; }

    match /households/{code} {
      allow get: if signedIn();
      allow list, delete: if false;
      allow create, update: if signedIn()
        && code.matches('^[a-z]+-[a-z]+-[a-z]+-[0-9]{4}$')
        && request.resource.data.keys().hasOnly(['members', 'createdAt'])
        && validName(request.resource.data.members.a.name, 30)
        && validName(request.resource.data.members.b.name, 30)
        && request.resource.data.createdAt is number;

      match /chores/{choreId} {
        allow read, delete: if signedIn();
        allow create, update: if signedIn()
          && request.resource.data.keys().hasOnly(['name', 'hours', 'assignee', 'createdAt', 'archivedAt'])
          && validName(request.resource.data.name, 60)
          && validHours(request.resource.data.hours)
          && isMember(request.resource.data.assignee)
          && request.resource.data.createdAt is number
          && (request.resource.data.archivedAt == null || request.resource.data.archivedAt is number);
      }

      match /weeks/{weekId} {
        allow read, delete: if signedIn();
        allow create, update: if signedIn()
          && weekId.matches('^[0-9]{4}-W[0-9]{2}$')
          && request.resource.data.keys().hasOnly(['weekId'])
          && request.resource.data.weekId == weekId;

        match /completions/{choreId} {
          allow read, delete: if signedIn();
          allow create, update: if signedIn()
            && request.resource.data.keys().hasOnly(['percent', 'name', 'hours', 'assignee', 'updatedAt'])
            && request.resource.data.percent in [0, 25, 50, 75, 100]
            && validName(request.resource.data.name, 60)
            && validHours(request.resource.data.hours)
            && isMember(request.resource.data.assignee)
            && request.resource.data.updatedAt is number;
        }

        match /feedback/{feedbackId} {
          allow read, delete: if signedIn();
          allow create, update: if signedIn()
            && request.resource.data.keys().hasOnly(['from', 'to', 'kind', 'text', 'createdAt', 'resolved'])
            && isMember(request.resource.data.from)
            && isMember(request.resource.data.to)
            && request.resource.data.from != request.resource.data.to
            && request.resource.data.kind in ['plus', 'minus']
            && validName(request.resource.data.text, 280)
            && request.resource.data.createdAt is number
            && request.resource.data.resolved is bool;
        }
      }
    }
  }
}
```

`vitest.rules.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/rules/**/*.test.ts'], testTimeout: 20_000 },
});
```

- [ ] **Step 2: Write rules tests**

`tests/rules/firestore.rules.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const CODE = 'tidy-otter-maple-4821';
const household = { members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, createdAt: 1 };
const chore = { name: 'Cooking', hours: 7, assignee: 'a', createdAt: 1, archivedAt: null };
const completion = { percent: 50, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 1 };
const feedback = { from: 'a', to: 'b', kind: 'minus', text: 'Dishes left out', createdAt: 1, resolved: false };

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-r2g',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const authed = () => env.authenticatedContext('device-1').firestore();
const anon = () => env.unauthenticatedContext().firestore();
const h = (db: ReturnType<typeof authed>, ...p: string[]) => doc(db, 'households', CODE, ...p);

test('signed-in device can create and read a household', async () => {
  await assertSucceeds(setDoc(h(authed()), household));
  await assertSucceeds(getDoc(h(authed())));
});

test('unauthenticated client cannot read', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'households', CODE), household));
  await assertFails(getDoc(h(anon())));
});

test('households cannot be listed', async () => {
  await assertFails(getDocs(collection(authed(), 'households')));
});

test('rejects malformed codes and extra fields', async () => {
  await assertFails(setDoc(doc(authed(), 'households', 'not-a-code'), household));
  await assertFails(setDoc(h(authed()), { ...household, admin: true }));
});

test('chore validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'chores', 'c1'), chore));
  await assertFails(setDoc(h(authed(), 'chores', 'c2'), { ...chore, hours: 0 }));
  await assertFails(setDoc(h(authed(), 'chores', 'c3'), { ...chore, assignee: 'c' }));
});

test('completion validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41', 'completions', 'c1'), completion));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'completions', 'c1'), { ...completion, percent: 30 }));
});

test('week marker must match its id', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41'), { weekId: '2026-W41' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41'), { weekId: '2026-W40' }));
});

test('feedback validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f1'), feedback));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f2'), { ...feedback, to: 'a' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f3'), { ...feedback, text: '' }));
});
```

- [ ] **Step 3: Run rules tests**

Run:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
npm run test:rules
```
Expected: PASS (8 tests). If a rule is wrong the corresponding `assertSucceeds`/`assertFails` fails — fix `firestore.rules`, not the test.

- [ ] **Step 4: Firebase init**

`src/firebase/config.ts`:
```ts
// Firebase web config is public by design; access is guarded by firestore.rules.
// Replace with the values from Firebase console → Project settings → Your apps → Web app.
const realConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

export const firebaseConfig = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-r2g.firebaseapp.com', projectId: 'demo-r2g', appId: 'demo-app' }
  : realConfig;

export const isConfigured = useEmulator || realConfig.apiKey !== 'REPLACE_ME';
```

`src/firebase/app.ts`:
```ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, useEmulator } from './config';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let signIn: Promise<void> | undefined;

function init() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export function getDb(): Firestore {
  init();
  return db!;
}

export function ensureSignedIn(): Promise<void> {
  init();
  signIn ??= (auth!.currentUser ? Promise.resolve() : signInAnonymously(auth!).then(() => undefined))
    .catch((e) => {
      signIn = undefined;
      throw e;
    });
  return signIn;
}
```

- [ ] **Step 5: Repo (writes, export, import)**

`src/firebase/repo.ts`:
```ts
import {
  collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  type DocumentReference, type Firestore,
} from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import type { Chore, Completion, Feedback, FeedbackKind, MemberId, Members, Percent } from '../domain/types';
import { other } from '../domain/types';
import type { ChoreView } from '../domain/scoring';
import type { Backup } from '../domain/backup';
import { STARTER_CHORES, starterAssignee } from '../domain/starterChores';

const hh = (db: Firestore, code: string) => doc(db, 'households', code);
const choresCol = (db: Firestore, code: string) => collection(db, 'households', code, 'chores');
const weekDoc = (db: Firestore, code: string, weekId: string) => doc(db, 'households', code, 'weeks', weekId);
const newId = () => crypto.randomUUID();

export async function householdExists(code: string): Promise<boolean> {
  await ensureSignedIn();
  return (await getDoc(hh(getDb(), code))).exists();
}

export async function createHousehold(code: string, members: Members): Promise<void> {
  await ensureSignedIn();
  const db = getDb();
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(hh(db, code), { members, createdAt: now });
  STARTER_CHORES.forEach((c, i) =>
    batch.set(doc(choresCol(db, code), newId()), {
      name: c.name, hours: c.hours, assignee: starterAssignee(i), createdAt: now + i, archivedAt: null,
    }),
  );
  await batch.commit();
}

export async function updateMembers(code: string, members: Members): Promise<void> {
  await ensureSignedIn();
  await updateDoc(hh(getDb(), code), { members });
}

export async function addChore(code: string, input: { name: string; hours: number; assignee: MemberId }) {
  await ensureSignedIn();
  await setDoc(doc(choresCol(getDb(), code), newId()), { ...input, createdAt: Date.now(), archivedAt: null });
}

export async function updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'assignee'>>) {
  await ensureSignedIn();
  await updateDoc(doc(choresCol(getDb(), code), id), patch);
}

export async function archiveChore(code: string, id: string) {
  await ensureSignedIn();
  await updateDoc(doc(choresCol(getDb(), code), id), { archivedAt: Date.now() });
}

export async function setCompletion(code: string, weekId: string, view: ChoreView, percent: Percent) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'completions', view.choreId), {
    percent, name: view.name, hours: view.hours, assignee: view.assignee, updatedAt: Date.now(),
  });
  await batch.commit();
}

export async function addFeedback(code: string, weekId: string, input: { from: MemberId; kind: FeedbackKind; text: string }) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'feedback', newId()), {
    from: input.from, to: other(input.from), kind: input.kind, text: input.text.trim(),
    createdAt: Date.now(), resolved: false,
  });
  await batch.commit();
}

export async function deleteFeedback(code: string, weekId: string, id: string) {
  await ensureSignedIn();
  await deleteDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id));
}

export async function setFeedbackResolved(code: string, weekId: string, id: string, resolved: boolean) {
  await ensureSignedIn();
  await updateDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id), { resolved });
}

export const toChore = (id: string, d: Record<string, unknown>): Chore => ({
  id, name: d.name as string, hours: d.hours as number, assignee: d.assignee as MemberId,
  createdAt: d.createdAt as number, archivedAt: (d.archivedAt as number | null) ?? null,
});
export const toCompletion = (id: string, d: Record<string, unknown>): Completion => ({
  choreId: id, percent: d.percent as Percent, name: d.name as string, hours: d.hours as number,
  assignee: d.assignee as MemberId, updatedAt: d.updatedAt as number,
});
export const toFeedback = (id: string, d: Record<string, unknown>): Feedback => ({
  id, from: d.from as MemberId, to: d.to as MemberId, kind: d.kind as FeedbackKind,
  text: d.text as string, createdAt: d.createdAt as number, resolved: Boolean(d.resolved),
});

export async function exportHousehold(code: string): Promise<Backup> {
  await ensureSignedIn();
  const db = getDb();
  const h = await getDoc(hh(db, code));
  if (!h.exists()) throw new Error('Household not found.');
  const chores = (await getDocs(choresCol(db, code))).docs.map((d) => toChore(d.id, d.data()));
  const weeks: Backup['weeks'] = {};
  for (const w of (await getDocs(collection(db, 'households', code, 'weeks'))).docs) {
    const [c, f] = await Promise.all([
      getDocs(collection(w.ref, 'completions')),
      getDocs(collection(w.ref, 'feedback')),
    ]);
    weeks[w.id] = {
      completions: c.docs.map((d) => toCompletion(d.id, d.data())),
      feedback: f.docs.map((d) => toFeedback(d.id, d.data())),
    };
  }
  return { version: 1, exportedAt: Date.now(), code, members: h.data().members as Members, chores, weeks };
}

type Op = { ref: DocumentReference; data?: Record<string, unknown> };

async function commitInChunks(db: Firestore, ops: Op[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      if (op.data) batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

export async function importHousehold(code: string, backup: Backup): Promise<void> {
  await ensureSignedIn();
  const db = getDb();
  const deletes: Op[] = (await getDocs(choresCol(db, code))).docs.map((d) => ({ ref: d.ref }));
  for (const w of (await getDocs(collection(db, 'households', code, 'weeks'))).docs) {
    for (const sub of ['completions', 'feedback']) {
      (await getDocs(collection(w.ref, sub))).docs.forEach((d) => deletes.push({ ref: d.ref }));
    }
    deletes.push({ ref: w.ref });
  }
  await commitInChunks(db, deletes);

  const sets: Op[] = [{ ref: hh(db, code), data: { members: backup.members, createdAt: Date.now() } }];
  for (const { id, ...c } of backup.chores) sets.push({ ref: doc(choresCol(db, code), id), data: c });
  for (const [weekId, w] of Object.entries(backup.weeks)) {
    sets.push({ ref: weekDoc(db, code, weekId), data: { weekId } });
    for (const { choreId, ...c } of w.completions) sets.push({ ref: doc(weekDoc(db, code, weekId), 'completions', choreId), data: c });
    for (const { id, ...f } of w.feedback) sets.push({ ref: doc(weekDoc(db, code, weekId), 'feedback', id), data: f });
  }
  await commitInChunks(db, sets);
}
```

- [ ] **Step 6: Live hooks**

`src/firebase/hooks.ts`:
```ts
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import { toChore, toCompletion, toFeedback } from './repo';
import type { Chore, Completion, Feedback, Members } from '../domain/types';

function useSignedIn(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // Offline first launch: sign-in fails, but cached reads still work once a prior session exists.
    ensureSignedIn().catch(() => undefined).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  return ready;
}

export function useHouseholdDoc(code: string) {
  const ready = useSignedIn();
  const [state, setState] = useState<{ members: Members | null; loading: boolean }>({ members: null, loading: true });
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(
      doc(getDb(), 'households', code),
      (s) => setState({ members: s.exists() ? (s.data().members as Members) : null, loading: s.metadata.fromCache && !s.exists() }),
      () => setState({ members: null, loading: false }),
    );
  }, [ready, code]);
  return state;
}

export function useChores(code: string): Chore[] {
  const ready = useSignedIn();
  const [chores, setChores] = useState<Chore[]>([]);
  useEffect(() => {
    if (!ready) return;
    return onSnapshot(collection(getDb(), 'households', code, 'chores'), (s) =>
      setChores(s.docs.map((d) => toChore(d.id, d.data()))),
    );
  }, [ready, code]);
  return chores;
}

export function useWeek(code: string, weekId: string) {
  const ready = useSignedIn();
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setCompletions([]);
    setFeedback([]);
    const base = ['households', code, 'weeks', weekId] as const;
    const un1 = onSnapshot(collection(getDb(), ...base, 'completions'), (s) => {
      setCompletions(s.docs.map((d) => toCompletion(d.id, d.data())));
      setLoading(false);
    });
    const un2 = onSnapshot(collection(getDb(), ...base, 'feedback'), (s) =>
      setFeedback(s.docs.map((d) => toFeedback(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
    );
    return () => { un1(); un2(); };
  }, [ready, code, weekId]);
  return { completions, feedback, loading };
}

export type SyncStatus = 'synced' | 'saving' | 'offline';

export function useSyncStatus(code: string): SyncStatus {
  const ready = useSignedIn();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    // Any pending write in the household tree shows up on at least one listened query; chores is the busiest.
    return onSnapshot(collection(getDb(), 'households', code, 'chores'), { includeMetadataChanges: true },
      (s) => setPending(s.metadata.hasPendingWrites));
  }, [ready, code]);
  if (!online) return 'offline';
  return pending ? 'saving' : 'synced';
}
```

- [ ] **Step 7: Type-check and run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all unit tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Firebase layer, live hooks and Firestore security rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App shell, onboarding and household context

**Files:**
- Create: `src/state/HouseholdContext.tsx`, `src/components/icons.tsx`, `src/components/TabBar.tsx`, `src/screens/SetupNeeded.tsx`, `src/screens/Onboarding.tsx`
- Create (placeholder bodies replaced in Tasks 7–11): `src/screens/Dashboard.tsx`, `src/screens/Todo.tsx`, `src/screens/Feedback.tsx`, `src/screens/Config.tsx`, `src/screens/Settings.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`
- Test: `src/components/TabBar.test.tsx`

**Interfaces:**
- Consumes: `loadDevice`, `saveDevice`, `DeviceState`, `EMPTY_DEVICE`; hooks `useHouseholdDoc`, `useChores`; repo `createHousehold`, `householdExists`; `generateCode`, `normalizeCode`, `isValidCode`; `weekIdOf`; `isConfigured`.
- Produces:
  - `HouseholdContext` (React context) and `useHousehold(): HouseholdCtx` where
    `interface HouseholdCtx { code: string; me: MemberId; members: Members; chores: Chore[]; currentWeekId: string; device: DeviceState; updateDevice(patch: Partial<DeviceState>): void }`
  - `type TabId = 'config' | 'feedback' | 'dashboard' | 'todo' | 'settings'`; `TABS: { id: TabId; label: string }[]` in display order; `TabBar({ active, onChange })`
  - Each screen is a named export with no props: `Dashboard`, `Todo`, `Feedback`, `Config`, `Settings`.

- [ ] **Step 1: Write failing TabBar test**

`src/components/TabBar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('tabs are in the agreed order with Dashboard in the centre', () => {
  render(<TabBar active="dashboard" onChange={() => {}} />);
  const labels = screen.getAllByRole('tab').map((b) => b.textContent);
  expect(labels).toEqual(['Setup', 'Feedback', 'Home', 'To-do', 'Settings']);
  expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
});

test('clicking a tab reports it', async () => {
  const onChange = vi.fn();
  render(<TabBar active="dashboard" onChange={onChange} />);
  await userEvent.click(screen.getByRole('tab', { name: 'To-do' }));
  expect(onChange).toHaveBeenCalledWith('todo');
});
```

Update `src/App.test.tsx` (App now shows the setup screen because the config is a placeholder):
```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('shows setup instructions when Firebase is not configured', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Responsible 2gether' })).toBeInTheDocument();
  expect(screen.getByText(/Firebase isn’t configured yet/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./TabBar` not found; App test fails on missing setup text.

- [ ] **Step 3: Implement icons and TabBar**

`src/components/icons.tsx`:
```tsx
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconSliders = () => (<svg {...base}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>);
export const IconChat = () => (<svg {...base}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>);
export const IconPie = () => (<svg {...base}><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></svg>);
export const IconCheck = () => (<svg {...base}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></svg>);
export const IconGear = () => (<svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
```

`src/components/TabBar.tsx`:
```tsx
import type { ReactElement } from 'react';
import { IconCheck, IconChat, IconGear, IconPie, IconSliders } from './icons';

export type TabId = 'config' | 'feedback' | 'dashboard' | 'todo' | 'settings';

export const TABS: { id: TabId; label: string; icon: () => ReactElement }[] = [
  { id: 'config', label: 'Setup', icon: IconSliders },
  { id: 'feedback', label: 'Feedback', icon: IconChat },
  { id: 'dashboard', label: 'Home', icon: IconPie },
  { id: 'todo', label: 'To-do', icon: IconCheck },
  { id: 'settings', label: 'Settings', icon: IconGear },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Sections">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={`tab${id === 'dashboard' ? ' tab-center' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="tab-icon"><Icon /></span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Context, setup screen, onboarding, placeholder screens, App**

`src/state/HouseholdContext.tsx`:
```tsx
import { createContext, useContext } from 'react';
import type { Chore, MemberId, Members } from '../domain/types';
import type { DeviceState } from '../device';

export interface HouseholdCtx {
  code: string;
  me: MemberId;
  members: Members;
  chores: Chore[];
  currentWeekId: string;
  device: DeviceState;
  updateDevice(patch: Partial<DeviceState>): void;
}

export const HouseholdContext = createContext<HouseholdCtx | null>(null);

export function useHousehold(): HouseholdCtx {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold outside HouseholdContext');
  return ctx;
}
```

`src/screens/SetupNeeded.tsx`:
```tsx
export function SetupNeeded() {
  return (
    <main className="page narrow">
      <h1>Responsible 2gether</h1>
      <div className="card">
        <p><strong>Firebase isn’t configured yet.</strong></p>
        <ol>
          <li>Create a free Firebase project and add a Web app.</li>
          <li>Enable <em>Anonymous</em> sign-in and Cloud Firestore.</li>
          <li>Paste the web config into <code>src/firebase/config.ts</code>.</li>
          <li>Deploy <code>firestore.rules</code> and rebuild.</li>
        </ol>
        <p className="muted">See README.md for the full steps.</p>
      </div>
    </main>
  );
}
```

`src/screens/Onboarding.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import type { MemberId, Members } from '../domain/types';
import { generateCode, isValidCode, normalizeCode } from '../domain/householdCode';
import { createHousehold, householdExists } from '../firebase/repo';

type Step = 'choose' | 'create' | 'join';

export function readJoinCode(hash: string): string | null {
  const m = /join=([a-z0-9-]+)/i.exec(hash);
  return m ? normalizeCode(m[1]) : null;
}

export function Onboarding({ onHousehold }: { onHousehold(code: string): void }) {
  const linked = readJoinCode(location.hash);
  const [step, setStep] = useState<Step>(linked ? 'join' : 'choose');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [code, setCode] = useState(linked ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!nameA.trim() || !nameB.trim()) return setError('Please enter both names.');
    setBusy(true); setError(null);
    try {
      const newCode = generateCode();
      await createHousehold(newCode, { a: { name: nameA.trim() }, b: { name: nameB.trim() } });
      onHousehold(newCode);
    } catch {
      setError('Couldn’t create the household. Are you online?');
    } finally { setBusy(false); }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!isValidCode(c)) return setError('That doesn’t look like a household code (word-word-word-1234).');
    setBusy(true); setError(null);
    try {
      if (!(await householdExists(c))) { setError('No household with that code.'); return; }
      history.replaceState(null, '', location.pathname);
      onHousehold(c);
    } catch {
      setError('Couldn’t reach the server. Are you online?');
    } finally { setBusy(false); }
  }

  return (
    <main className="page narrow">
      <h1>Responsible 2gether</h1>
      <p className="muted">Keep the home tidy, together.</p>
      {step === 'choose' && (
        <div className="stack">
          <button className="btn primary" onClick={() => setStep('create')}>Create our household</button>
          <button className="btn" onClick={() => setStep('join')}>Join with a code</button>
        </div>
      )}
      {step === 'create' && (
        <form className="card stack" onSubmit={create}>
          <label>First person’s name<input value={nameA} maxLength={30} onChange={(e) => setNameA(e.target.value)} autoFocus /></label>
          <label>Second person’s name<input value={nameB} maxLength={30} onChange={(e) => setNameB(e.target.value)} /></label>
          <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
          <button type="button" className="btn ghost" onClick={() => setStep('choose')}>Back</button>
        </form>
      )}
      {step === 'join' && (
        <form className="card stack" onSubmit={join}>
          <label>Household code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="tidy-otter-maple-4821" autoCapitalize="none" autoFocus /></label>
          <button className="btn primary" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
          <button type="button" className="btn ghost" onClick={() => setStep('choose')}>Back</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}

export function WhoAreYou({ members, onPick }: { members: Members; onPick(m: MemberId): void }) {
  return (
    <main className="page narrow">
      <h1>Who’s using this phone?</h1>
      <div className="stack">
        {(['a', 'b'] as const).map((m) => (
          <button key={m} className={`btn big member-${m}`} onClick={() => onPick(m)}>{members[m].name}</button>
        ))}
      </div>
    </main>
  );
}
```

Placeholder screens (each file; replaced in Tasks 7–11). Example `src/screens/Dashboard.tsx`:
```tsx
export function Dashboard() {
  return <main className="page"><h1>Home</h1></main>;
}
```
Create the same shape for `Todo` (`<h1>To-do</h1>`), `Feedback` (`<h1>Feedback</h1>`), `Config` (`<h1>Chores setup</h1>`), `Settings` (`<h1>Settings</h1>`) in their own files.

`src/App.tsx`:
```tsx
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { isConfigured } from './firebase/config';
import { useChores, useHouseholdDoc } from './firebase/hooks';
import { loadDevice, saveDevice, type DeviceState } from './device';
import { weekIdOf } from './domain/week';
import { HouseholdContext, type HouseholdCtx } from './state/HouseholdContext';
import { TabBar, type TabId } from './components/TabBar';
import { SetupNeeded } from './screens/SetupNeeded';
import { Onboarding, WhoAreYou } from './screens/Onboarding';
import { Dashboard } from './screens/Dashboard';
import { Todo } from './screens/Todo';
import { Feedback } from './screens/Feedback';
import { Config } from './screens/Config';
import { Settings } from './screens/Settings';

const SCREENS: Record<TabId, () => ReactElement> = { config: Config, feedback: Feedback, dashboard: Dashboard, todo: Todo, settings: Settings };

function useCurrentWeekId(): string {
  const [id, setId] = useState(() => weekIdOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => setId(weekIdOf(new Date())), 60_000);
    const onVisible = () => document.visibilityState === 'visible' && setId(weekIdOf(new Date()));
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return id;
}

export default function App() {
  const [device, setDevice] = useState<DeviceState>(loadDevice);
  const updateDevice = (patch: Partial<DeviceState>) =>
    setDevice((d) => { const next = { ...d, ...patch }; saveDevice(next); return next; });

  if (!isConfigured) return <SetupNeeded />;
  if (!device.code) return <Onboarding onHousehold={(code) => updateDevice({ code, me: null })} />;
  return <Household code={device.code} device={device} updateDevice={updateDevice} />;
}

function Household({ code, device, updateDevice }: { code: string; device: DeviceState; updateDevice(p: Partial<DeviceState>): void }) {
  const { members, loading } = useHouseholdDoc(code);
  const chores = useChores(code);
  const currentWeekId = useCurrentWeekId();
  const [tab, setTab] = useState<TabId>('dashboard');

  const ctx = useMemo<HouseholdCtx | null>(
    () => (members && device.me ? { code, me: device.me, members, chores, currentWeekId, device, updateDevice } : null),
    [code, members, chores, currentWeekId, device],
  );

  if (loading) return <main className="page narrow"><p className="muted">Loading…</p></main>;
  if (!members) {
    return (
      <main className="page narrow">
        <h1>Household not found</h1>
        <p className="muted">The code <code>{code}</code> doesn’t exist any more.</p>
        <button className="btn" onClick={() => updateDevice({ code: null, me: null })}>Start over</button>
      </main>
    );
  }
  if (!device.me || !ctx) return <WhoAreYou members={members} onPick={(me) => updateDevice({ me })} />;

  const Screen = SCREENS[tab];
  return (
    <HouseholdContext.Provider value={ctx}>
      <div className="app">
        <Screen />
        <TabBar active={tab} onChange={setTab} />
      </div>
    </HouseholdContext.Provider>
  );
}
```

Append to `src/styles.css`:
```css
.app { min-height: 100dvh; padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
.page { max-width: 560px; margin: 0 auto; padding: 20px 16px 24px; }
.page.narrow { max-width: 420px; padding-top: 48px; }
h1 { font-size: 1.5rem; margin: 0 0 12px; }
h2 { font-size: 1.05rem; margin: 24px 0 8px; }
.muted { color: var(--muted); }
.error { color: var(--danger); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 6px; font-size: .9rem; color: var(--muted); }
input, textarea, select { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 1rem; color: var(--text); }
textarea { resize: vertical; min-height: 80px; font: inherit; }
.btn { border: 1px solid var(--border); background: var(--surface); border-radius: 12px; padding: 12px 16px; font-weight: 600; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.ghost { background: none; border-color: transparent; color: var(--muted); }
.btn.big { padding: 20px; font-size: 1.2rem; }
.btn.danger { color: var(--danger); }
.btn:disabled { opacity: .6; }
.member-a { border-color: hsl(174 60% 40%); }
.member-b { border-color: hsl(12 80% 58%); }

.tabbar { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(5, 1fr);
  align-items: end; background: var(--surface); border-top: 1px solid var(--border);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); z-index: 10; }
.tab { background: none; border: 0; color: var(--muted); display: flex; flex-direction: column; align-items: center;
  gap: 2px; padding: 6px 0; font-size: .7rem; cursor: pointer; }
.tab[aria-selected="true"] { color: var(--accent); }
.tab-center .tab-icon { background: var(--accent); color: #fff; width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center; margin-top: -26px; box-shadow: 0 4px 14px rgb(0 0 0 / .18); }
.tab-center[aria-selected="false"] .tab-icon { opacity: .85; }
```

- [ ] **Step 5: Run tests and type-check**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: app shell, onboarding, who-are-you and tab bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Dashboard (donut + helpfulness + kind words)

**Files:**
- Create: `src/components/colors.ts`, `src/components/Donut.tsx`, `src/components/HelpBar.tsx`
- Modify: `src/screens/Dashboard.tsx`, `src/styles.css`
- Test: `src/components/Donut.test.tsx`, `src/screens/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `useWeek`, `choresForWeek`, `donutSlices`, `memberHours`, `sharePercents`, `helpfulness`, `shiftWeek`, `formatWeekRange`, `exportReminderDue`, `other`.
- Produces: `sliceColor(member: MemberId | null, shadeIndex: number, shadeCount: number): string`; `memberColor(member: MemberId): string`; `Donut({ slices, label }: { slices: DonutSlice[]; label: ReactNode })`; `HelpBar({ name, value, member }: { name: string; value: number; member: MemberId })`.

- [ ] **Step 1: Write failing tests**

`src/components/Donut.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { Donut } from './Donut';
import { sliceColor } from './colors';

test('one arc per slice with dash length proportional to value', () => {
  const { container } = render(
    <Donut label="x" slices={[
      { key: 'a1', label: 'Cooking', value: 3, member: 'a', shadeIndex: 0, shadeCount: 1 },
      { key: 'notdone', label: 'Not done yet', value: 1, member: null, shadeIndex: 0, shadeCount: 1 },
    ]} />,
  );
  const arcs = container.querySelectorAll('circle[data-slice]');
  expect(arcs).toHaveLength(2);
  const len = (el: Element) => Number(el.getAttribute('stroke-dasharray')!.split(' ')[0]);
  expect(len(arcs[0]) / len(arcs[1])).toBeCloseTo(3);
  expect(arcs[0].querySelector('title')!.textContent).toBe('Cooking — 3 h');
});

test('empty chart draws a single empty ring', () => {
  const { container } = render(<Donut label="x" slices={[]} />);
  expect(container.querySelectorAll('circle[data-slice]')).toHaveLength(0);
  expect(container.querySelector('circle.donut-track')).not.toBeNull();
});

test('shades stay within the member hue and get lighter', () => {
  expect(sliceColor('a', 0, 3)).toMatch(/^hsl\(174 /);
  expect(sliceColor('b', 2, 3)).toMatch(/^hsl\(12 /);
  expect(sliceColor(null, 0, 1)).toBe('var(--slice-empty)');
  const light = (c: string) => Number(/ (\d+)%\)$/.exec(c)![1]);
  expect(light(sliceColor('a', 2, 3))).toBeGreaterThan(light(sliceColor('a', 0, 3)));
});
```

`src/screens/Dashboard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Dashboard } from './Dashboard';

vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false,
    completions: [{ choreId: 'c1', percent: 100, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 1 }],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'plus', text: 'Lovely dinner', createdAt: 2, resolved: false },
      { id: 'f2', from: 'a', to: 'b', kind: 'minus', text: 'Towels on floor', createdAt: 3, resolved: false },
    ],
  }),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 1, assignee: 'b', createdAt: 1, archivedAt: null },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
};

test('shows shares, helpfulness and kind words for me', () => {
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getAllByText('Iman').length).toBeGreaterThan(0);
  expect(screen.getByTestId('share-a')).toHaveTextContent('100%');
  expect(screen.getByRole('meter', { name: /Sam helpfulness/ })).toHaveAttribute('aria-valuenow', '90');
  expect(screen.getByRole('meter', { name: /Iman helpfulness/ })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText(/Lovely dinner/)).toBeInTheDocument();
  expect(screen.queryByText(/Towels on floor/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/Donut.test.tsx src/screens/Dashboard.test.tsx`
Expected: FAIL — modules missing / placeholder Dashboard.

- [ ] **Step 3: Implement colours, Donut, HelpBar**

`src/components/colors.ts`:
```ts
import type { MemberId } from '../domain/types';

const HUE: Record<MemberId, number> = { a: 174, b: 12 };
const SAT: Record<MemberId, number> = { a: 60, b: 80 };

export function sliceColor(member: MemberId | null, shadeIndex: number, shadeCount: number): string {
  if (member === null) return 'var(--slice-empty)';
  const t = shadeCount <= 1 ? 0 : shadeIndex / (shadeCount - 1);
  const light = Math.round(34 + t * 36); // 34% → 70%
  return `hsl(${HUE[member]} ${SAT[member]}% ${light}%)`;
}

export const memberColor = (m: MemberId) => sliceColor(m, 0, 3).replace(/ 34%\)$/, ' 42%)');
```

`src/components/Donut.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { DonutSlice } from '../domain/scoring';
import { sliceColor } from './colors';

const SIZE = 240, STROKE = 38, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
const fmt = (h: number) => `${Math.round(h * 100) / 100} h`;

export function Donut({ slices, label }: { slices: DonutSlice[]; label: ReactNode }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Share of chores done this week">
        <circle className="donut-track" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--slice-empty)" strokeWidth={STROKE} />
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {total > 0 && slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.key}
                data-slice={s.key}
                cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                stroke={sliceColor(s.member, s.shadeIndex, s.shadeCount)}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${s.label} — ${fmt(s.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-label">{label}</div>
    </div>
  );
}
```

`src/components/HelpBar.tsx`:
```tsx
import type { MemberId } from '../domain/types';
import { memberColor } from './colors';

export function HelpBar({ name, value, member }: { name: string; value: number; member: MemberId }) {
  return (
    <div className="helpbar">
      <div className="helpbar-head"><span>{name}</span><strong>{value}%</strong></div>
      <div className="helpbar-track" role="meter" aria-label={`${name} helpfulness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="helpbar-fill" style={{ width: `${value}%`, background: memberColor(member) }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement Dashboard**

`src/screens/Dashboard.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { choresForWeek, donutSlices, helpfulness, memberHours, sharePercents } from '../domain/scoring';
import { formatWeekRange, shiftWeek } from '../domain/week';
import { other } from '../domain/types';
import { exportReminderDue } from '../device';
import { Donut } from '../components/Donut';
import { HelpBar } from '../components/HelpBar';
import { memberColor, sliceColor } from '../components/colors';

const h = (n: number) => `${Math.round(n * 10) / 10} h`;

export function Dashboard() {
  const { code, me, members, chores, currentWeekId, device } = useHousehold();
  const [weekId, setWeekId] = useState(currentWeekId);
  useEffect(() => setWeekId(currentWeekId), [currentWeekId]);
  const isCurrent = weekId === currentWeekId;
  const { completions, feedback } = useWeek(code, weekId);

  const views = choresForWeek(weekId, chores, completions, isCurrent);
  const slices = donutSlices(views);
  const pct = sharePercents(views);
  const hours = memberHours(views);
  const order = [me, other(me)] as const;
  const kindWords = feedback.filter((f) => f.kind === 'plus' && f.to === me);

  return (
    <main className="page">
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <p className="notice">Back up your data: Settings › Export.</p>
      )}
      <div className="weeknav">
        <button className="btn ghost" aria-label="Previous week" onClick={() => setWeekId(shiftWeek(weekId, -1))}>‹</button>
        <div><strong>{isCurrent ? 'This week' : weekId}</strong><div className="muted small">{formatWeekRange(weekId)}</div></div>
        <button className="btn ghost" aria-label="Next week" disabled={isCurrent} onClick={() => setWeekId(shiftWeek(weekId, 1))}>›</button>
      </div>

      <Donut
        slices={slices}
        label={hours.done === 0
          ? <span className="muted">Nothing done yet</span>
          : <><strong>{h(hours.done)}</strong><span className="muted small">of {h(hours.total)}</span></>}
      />

      <div className="legend">
        {order.map((m) => (
          <div key={m} className="legend-col">
            <div className="legend-head">
              <span className="dot" style={{ background: memberColor(m) }} />
              <span>{members[m].name}</span>
              <strong data-testid={`share-${m}`}>{pct[m]}%</strong>
            </div>
            <ul>
              {slices.filter((s) => s.member === m).map((s) => (
                <li key={s.key}>
                  <span className="dot small" style={{ background: sliceColor(s.member, s.shadeIndex, s.shadeCount) }} />
                  {s.label} <span className="muted">{h(s.value)}</span>
                </li>
              ))}
            </ul>
            <div className="muted small">{h(hours[m])} done of {h(views.filter((v) => v.assignee === m).reduce((s, v) => s + v.hours, 0))}</div>
          </div>
        ))}
      </div>

      <h2>Helpfulness</h2>
      <div className="card stack">
        {order.map((m) => <HelpBar key={m} name={members[m].name} member={m} value={helpfulness(feedback, m)} />)}
      </div>

      <h2>Kind words {isCurrent ? 'this week' : 'that week'}</h2>
      {kindWords.length === 0
        ? <p className="muted">None yet.</p>
        : <ul className="cards">{kindWords.map((f) => <li key={f.id} className="card kind">“{f.text}” <span className="muted small">— {members[f.from].name}</span></li>)}</ul>}
    </main>
  );
}
```

Append to `src/styles.css`:
```css
.small { font-size: .8rem; }
.notice { background: var(--warn-bg); color: var(--warn-text); border-radius: 10px; padding: 10px 12px; margin: 0 0 12px; font-size: .9rem; }
.weeknav { display: flex; align-items: center; justify-content: space-between; text-align: center; margin-bottom: 8px; }
.weeknav .btn { font-size: 1.6rem; padding: 4px 14px; }
.donut { position: relative; width: min(260px, 72vw); margin: 0 auto; }
.donut svg { width: 100%; height: auto; display: block; }
.donut-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.donut-label strong { font-size: 1.6rem; }
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.legend-head { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.legend-head strong { margin-left: auto; }
.legend ul { list-style: none; padding: 0; margin: 6px 0; font-size: .85rem; }
.legend li { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
.legend li .muted { margin-left: auto; }
.dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; flex: none; }
.dot.small { width: 8px; height: 8px; }
.helpbar-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.helpbar-track { height: 12px; border-radius: 6px; background: var(--slice-empty); overflow: hidden; }
.helpbar-fill { height: 100%; border-radius: 6px; transition: width .3s; }
.cards { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
```

- [ ] **Step 5: Run to verify tests pass**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dashboard with chore donut, helpfulness bars and kind words

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: To-do tab

**Files:**
- Create: `src/components/SegmentedPercent.tsx`
- Modify: `src/screens/Todo.tsx`, `src/styles.css`
- Test: `src/components/SegmentedPercent.test.tsx`, `src/screens/Todo.test.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `useWeek`, `choresForWeek`, `setCompletion`, `setFeedbackResolved`, `PERCENTS`.
- Produces: `SegmentedPercent({ value, onChange, label }: { value: Percent; onChange(p: Percent): void; label: string })`.

- [ ] **Step 1: Write failing tests**

`src/components/SegmentedPercent.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedPercent } from './SegmentedPercent';

test('five options, current one pressed, click reports value', async () => {
  const onChange = vi.fn();
  render(<SegmentedPercent label="Cooking" value={50} onChange={onChange} />);
  const buttons = screen.getAllByRole('radio');
  expect(buttons.map((b) => b.textContent)).toEqual(['0', '25', '50', '75', '100']);
  expect(screen.getByRole('radio', { name: '50' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: '100' }));
  expect(onChange).toHaveBeenCalledWith(100);
});
```

`src/screens/Todo.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Todo } from './Todo';

const setCompletion = vi.fn();
const setFeedbackResolved = vi.fn();
vi.mock('../firebase/repo', () => ({
  setCompletion: (...a: unknown[]) => setCompletion(...a),
  setFeedbackResolved: (...a: unknown[]) => setFeedbackResolved(...a),
}));
vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false,
    completions: [],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plate left on sofa', createdAt: 2, resolved: false },
      { id: 'f2', from: 'b', to: 'a', kind: 'plus', text: 'Nice', createdAt: 3, resolved: false },
    ],
  }),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 1, assignee: 'b', createdAt: 1, archivedAt: null },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null },
  updateDevice: () => {},
};

test('lists only my chores and writes completion', async () => {
  render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);
  expect(screen.getByText('Cooking')).toBeInTheDocument();
  expect(screen.queryByText('Trash')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '75' }));
  expect(setCompletion).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41',
    { choreId: 'c1', name: 'Cooking', hours: 7, assignee: 'a', percent: 0 }, 75);
});

test('negative feedback appears as a checkbox task', async () => {
  render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);
  expect(screen.queryByText('Nice')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /Plate left on sofa/ }));
  expect(setFeedbackResolved).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41', 'f1', true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/SegmentedPercent.test.tsx src/screens/Todo.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/SegmentedPercent.tsx`:
```tsx
import { PERCENTS, type Percent } from '../domain/types';

export function SegmentedPercent({ value, onChange, label }: { value: Percent; onChange(p: Percent): void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={`${label} completion`}>
      {PERCENTS.map((p) => (
        <button key={p} role="radio" aria-checked={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}
```

`src/screens/Todo.tsx`:
```tsx
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { setCompletion, setFeedbackResolved } from '../firebase/repo';
import { choresForWeek } from '../domain/scoring';
import { SegmentedPercent } from '../components/SegmentedPercent';

const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function Todo() {
  const { code, me, members, chores, currentWeekId } = useHousehold();
  const { completions, feedback } = useWeek(code, currentWeekId);
  const mine = choresForWeek(currentWeekId, chores, completions, true).filter((v) => v.assignee === me && chores.find((c) => c.id === v.choreId)?.archivedAt === null);
  const tasks = feedback.filter((f) => f.kind === 'minus' && f.to === me);

  return (
    <main className="page">
      <h1>To-do</h1>
      <h2>Your chores <span className="muted small">% done this week</span></h2>
      {mine.length === 0 ? <p className="muted">No chores assigned to you.</p> : (
        <ul className="cards">
          {mine.map((v) => (
            <li key={v.choreId} className="card todo-row">
              <div className="todo-head"><span>{v.name}</span><span className="muted small">{v.hours} h/wk</span></div>
              <SegmentedPercent label={v.name} value={v.percent} onChange={(p) => void setCompletion(code, currentWeekId, v, p)} />
            </li>
          ))}
        </ul>
      )}

      <h2>Feedback to act on</h2>
      {tasks.length === 0 ? <p className="muted">Nothing from {members[me === 'a' ? 'b' : 'a'].name} this week.</p> : (
        <ul className="cards">
          {tasks.map((f) => (
            <li key={f.id} className={`card check-row${f.resolved ? ' done' : ''}`}>
              <label>
                <input type="checkbox" checked={f.resolved} onChange={(e) => void setFeedbackResolved(code, currentWeekId, f.id, e.target.checked)} />
                <span>{f.text}</span>
              </label>
              <span className="muted small">{when(f.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

Append to `src/styles.css`:
```css
.todo-row { display: flex; flex-direction: column; gap: 10px; }
.todo-head { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; }
.segmented { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.segmented button { border: 0; border-right: 1px solid var(--border); background: var(--bg); padding: 10px 0; font-size: .9rem; cursor: pointer; }
.segmented button:last-child { border-right: 0; }
.segmented button.on { background: var(--accent); color: #fff; font-weight: 700; }
.check-row label { flex-direction: row; align-items: center; gap: 10px; color: var(--text); font-size: 1rem; }
.check-row input { width: 22px; height: 22px; accent-color: var(--accent); }
.check-row.done span { text-decoration: line-through; color: var(--muted); }
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: to-do tab with completion rates and feedback tasks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Feedback tab with ratio warning

**Files:**
- Modify: `src/screens/Feedback.tsx`, `src/styles.css`
- Test: `src/screens/Feedback.test.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `useWeek`, `addFeedback`, `deleteFeedback`, `feedbackCounts`, `ratioWarning`, `other`.

- [ ] **Step 1: Write failing test**

`src/screens/Feedback.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { Feedback as FB } from '../domain/types';
import { Feedback } from './Feedback';

const addFeedback = vi.fn();
const deleteFeedback = vi.fn();
let weekFeedback: FB[] = [];
vi.mock('../firebase/repo', () => ({
  addFeedback: (...a: unknown[]) => addFeedback(...a),
  deleteFeedback: (...a: unknown[]) => deleteFeedback(...a),
}));
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading: false, completions: [], feedback: weekFeedback }) }));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, chores: [],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice: () => {},
};
const fb = (kind: 'plus' | 'minus', i: number): FB => ({ id: `${kind}${i}`, from: 'a', to: 'b', kind, text: `${kind} ${i}`, createdAt: i, resolved: false });
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Feedback /></HouseholdContext.Provider>);

beforeEach(() => { weekFeedback = []; addFeedback.mockReset(); });

test('sends positive feedback about the partner', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText(/Note/), 'Thanks for cooking');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(addFeedback).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41', { from: 'a', kind: 'plus', text: 'Thanks for cooking' });
});

test('no warning with a healthy ratio', () => {
  weekFeedback = [fb('plus', 1), fb('plus', 2), fb('minus', 3)];
  renderIt();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('warns when given positives are fewer than twice the negatives', () => {
  weekFeedback = [...Array.from({ length: 9 }, (_, i) => fb('plus', i)), ...Array.from({ length: 5 }, (_, i) => fb('minus', 10 + i))];
  renderIt();
  expect(screen.getByRole('alert')).toHaveTextContent(/destructive/);
});

test('warns while composing a negative that would break the ratio', async () => {
  weekFeedback = [fb('plus', 1), fb('plus', 2), fb('minus', 3)];
  renderIt();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: /Needs work/ }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('empty note cannot be sent', async () => {
  renderIt();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/Feedback.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Feedback.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { addFeedback, deleteFeedback } from '../firebase/repo';
import { feedbackCounts, ratioWarning } from '../domain/scoring';
import { other, type FeedbackKind } from '../domain/types';

export function Feedback() {
  const { code, me, members, currentWeekId } = useHousehold();
  const { feedback } = useWeek(code, currentWeekId);
  const [kind, setKind] = useState<FeedbackKind>('plus');
  const [text, setText] = useState('');
  const partner = members[other(me)].name;
  const given = feedback.filter((f) => f.from === me);
  const { plus, minus } = feedbackCounts(feedback, me);
  const warn = ratioWarning(plus, minus + (kind === 'minus' ? 1 : 0));

  function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    void addFeedback(code, currentWeekId, { from: me, kind, text: text.trim() });
    setText('');
  }

  return (
    <main className="page">
      <h1>Feedback</h1>
      <p className="muted">How helpful has {partner} been around the house?</p>

      <form className="card stack" onSubmit={send}>
        <div className="kind-toggle" role="radiogroup" aria-label="Kind of feedback">
          <button type="button" role="radio" aria-checked={kind === 'plus'} className={kind === 'plus' ? 'on plus' : ''} onClick={() => setKind('plus')}>＋ Appreciated</button>
          <button type="button" role="radio" aria-checked={kind === 'minus'} className={kind === 'minus' ? 'on minus' : ''} onClick={() => setKind('minus')}>－ Needs work</button>
        </div>
        <label>Note
          <textarea value={text} maxLength={280} onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'plus' ? 'Thanks for folding the laundry!' : 'Plate left on the sofa after dinner'} />
        </label>
        {kind === 'minus' && <p className="muted small">This lowers {partner}’s helpfulness by 10% and becomes a task on their to-do list.</p>}
        <button className="btn primary" disabled={!text.trim()}>Send</button>
      </form>

      {warn && (
        <div className="warning" role="alert">
          <strong>Lots of negative feedback this week.</strong> You’ve given {plus} positive and {minus} negative so far.
          Too much negative feedback is usually just destructive. Consider redefining tasks, talking it through, or simply giving more positive feedback — aim for at least two positives per negative.
        </div>
      )}

      <h2>You gave this week <span className="muted small">＋{plus} · －{minus}</span></h2>
      {given.length === 0 ? <p className="muted">Nothing yet.</p> : (
        <ul className="cards">
          {given.map((f) => (
            <li key={f.id} className={`card given ${f.kind}`}>
              <span className="given-kind">{f.kind === 'plus' ? '＋' : '－'}</span>
              <span className="given-text">{f.text}{f.kind === 'minus' && f.resolved && <span className="muted small"> · handled</span>}</span>
              <button className="btn ghost small" aria-label={`Delete “${f.text}”`} onClick={() => void deleteFeedback(code, currentWeekId, f.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

Append to `src/styles.css`:
```css
.kind-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kind-toggle button { border: 1px solid var(--border); background: var(--bg); border-radius: 10px; padding: 10px; font-weight: 600; cursor: pointer; }
.kind-toggle button.on.plus { background: hsl(174 60% 40%); border-color: transparent; color: #fff; }
.kind-toggle button.on.minus { background: hsl(12 80% 55%); border-color: transparent; color: #fff; }
.warning { background: var(--warn-bg); color: var(--warn-text); border-radius: var(--radius); padding: 14px 16px; margin-top: 12px; font-size: .92rem; }
.given { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.given-kind { font-weight: 800; }
.given.plus .given-kind { color: hsl(174 60% 40%); }
.given.minus .given-kind { color: hsl(12 80% 55%); }
.given-text { flex: 1; }
.btn.small { padding: 4px 8px; }
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: feedback tab with 2:1 ratio warning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Configuration tab

**Files:**
- Modify: `src/screens/Config.tsx`, `src/styles.css`
- Test: `src/screens/Config.test.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `addChore`, `updateChore`, `archiveChore`, `other`.
- Produces: `clampHours(n: number): number` exported from `Config.tsx` (rounds to 0.25, clamps to [0.25, 40]).

- [ ] **Step 1: Write failing test**

`src/screens/Config.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Config, clampHours } from './Config';

const addChore = vi.fn(), updateChore = vi.fn(), archiveChore = vi.fn();
vi.mock('../firebase/repo', () => ({
  addChore: (...a: unknown[]) => addChore(...a),
  updateChore: (...a: unknown[]) => updateChore(...a),
  archiveChore: (...a: unknown[]) => archiveChore(...a),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 0.5, assignee: 'b', createdAt: 1, archivedAt: null },
    { id: 'c3', name: 'Old', hours: 1, assignee: 'b', createdAt: 2, archivedAt: 5 },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice: () => {},
};
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Config /></HouseholdContext.Provider>);

test.each([[0, 0.25], [0.3, 0.25], [0.4, 0.5], [99, 40], [Number.NaN, 0.25]])('clampHours(%s) = %s', (i, o) => {
  expect(clampHours(i)).toBe(o);
});

test('lists active chores with per-person totals', () => {
  renderIt();
  expect(screen.getByDisplayValue('Cooking')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Old')).not.toBeInTheDocument();
  expect(screen.getByTestId('total-a')).toHaveTextContent('7 h');
  expect(screen.getByTestId('total-b')).toHaveTextContent('0.5 h');
});

test('assignee toggle swaps person', async () => {
  renderIt();
  const row = screen.getByDisplayValue('Cooking').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Iman' }));
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c1', { assignee: 'b' });
});

test('remove archives after confirm', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderIt();
  const row = screen.getByDisplayValue('Trash').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: /Remove/ }));
  expect(archiveChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2');
});

test('adds a chore', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('New chore'), 'Vacuum');
  await userEvent.clear(screen.getByLabelText('Hours per week'));
  await userEvent.type(screen.getByLabelText('Hours per week'), '1.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add chore' }));
  expect(addChore).toHaveBeenCalledWith('tidy-otter-maple-4821', { name: 'Vacuum', hours: 1.5, assignee: 'a' });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/Config.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Config.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { addChore, archiveChore, updateChore } from '../firebase/repo';
import { MEMBER_IDS, other, type Chore, type MemberId } from '../domain/types';
import { memberColor } from '../components/colors';

export function clampHours(n: number): number {
  if (!Number.isFinite(n)) return 0.25;
  return Math.min(40, Math.max(0.25, Math.round(n * 4) / 4));
}

const fmt = (n: number) => `${Math.round(n * 100) / 100} h`;

function ChoreRow({ chore }: { chore: Chore }) {
  const { code, members } = useHousehold();
  const [name, setName] = useState(chore.name);
  const [hours, setHours] = useState(String(chore.hours));

  const commitName = () => {
    const n = name.trim().slice(0, 60);
    if (!n) return setName(chore.name);
    if (n !== chore.name) void updateChore(code, chore.id, { name: n });
  };
  const commitHours = () => {
    const h = clampHours(parseFloat(hours));
    setHours(String(h));
    if (h !== chore.hours) void updateChore(code, chore.id, { hours: h });
  };

  return (
    <li className="card chore-row">
      <input className="chore-name" aria-label="Chore name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={commitName} />
      <input className="chore-hours" aria-label={`${chore.name} hours per week`} type="number" inputMode="decimal" step={0.25} min={0.25} max={40}
        value={hours} onChange={(e) => setHours(e.target.value)} onBlur={commitHours} />
      <button className="btn assignee" style={{ borderColor: memberColor(chore.assignee) }}
        onClick={() => void updateChore(code, chore.id, { assignee: other(chore.assignee) })}>
        {members[chore.assignee].name}
      </button>
      <button className="btn ghost small" aria-label={`Remove ${chore.name}`}
        onClick={() => { if (confirm(`Remove “${chore.name}”? Past weeks keep it.`)) void archiveChore(code, chore.id); }}>✕</button>
    </li>
  );
}

export function Config() {
  const { code, me, members, chores } = useHousehold();
  const active = chores.filter((c) => c.archivedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  const total = (m: MemberId) => active.filter((c) => c.assignee === m).reduce((s, c) => s + c.hours, 0);
  const [name, setName] = useState('');
  const [hours, setHours] = useState('1');
  const [assignee, setAssignee] = useState<MemberId>(me);

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 60);
    if (!n) return;
    void addChore(code, { name: n, hours: clampHours(parseFloat(hours)), assignee });
    setName(''); setHours('1');
  }

  return (
    <main className="page">
      <h1>Chores setup</h1>
      <div className="totals">
        {MEMBER_IDS.map((m) => (
          <div key={m} className="card total">
            <span className="dot" style={{ background: memberColor(m) }} /> {members[m].name}
            <strong data-testid={`total-${m}`}>{fmt(total(m))}</strong>
          </div>
        ))}
      </div>
      <p className="muted small">Hours per week · tap a name to reassign.</p>
      <ul className="cards">{active.map((c) => <ChoreRow key={c.id} chore={c} />)}</ul>

      <h2>Add a chore</h2>
      <form className="card stack" onSubmit={add}>
        <label>New chore<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Vacuum the flat" /></label>
        <label>Hours per week<input type="number" inputMode="decimal" step={0.25} min={0.25} max={40} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
        <div className="kind-toggle" role="radiogroup" aria-label="Assignee">
          {MEMBER_IDS.map((m) => (
            <button type="button" key={m} role="radio" aria-checked={assignee === m} className={assignee === m ? 'on plus' : ''} onClick={() => setAssignee(m)}>{members[m].name}</button>
          ))}
        </div>
        <button className="btn primary" disabled={!name.trim()}>Add chore</button>
      </form>
    </main>
  );
}
```

Append to `src/styles.css`:
```css
.totals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.total { display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
.total strong { margin-left: auto; }
.chore-row { display: grid; grid-template-columns: 1fr 72px auto auto; gap: 8px; align-items: center; padding: 8px; }
.chore-row input { padding: 8px; min-width: 0; }
.chore-name { border-color: transparent; background: none; }
.btn.assignee { padding: 8px 10px; font-size: .85rem; border-width: 2px; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: configuration tab to add, edit, reassign and remove chores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Settings tab (names, identity, share, sync, backup)

**Files:**
- Modify: `src/screens/Settings.tsx`, `src/styles.css`
- Test: `src/screens/Settings.test.tsx`

**Interfaces:**
- Consumes: `useHousehold`, `useSyncStatus`, `updateMembers`, `exportHousehold`, `importHousehold`, `validateBackup`, `exportReminderDue`.
- Produces: `backupFileName(now: Date): string` exported from `Settings.tsx` → `responsible-2gether-backup-YYYY-MM-DD.json`.

- [ ] **Step 1: Write failing test**

`src/screens/Settings.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Settings, backupFileName } from './Settings';

const updateMembers = vi.fn(), importHousehold = vi.fn();
vi.mock('../firebase/repo', () => ({
  updateMembers: (...a: unknown[]) => updateMembers(...a),
  exportHousehold: vi.fn(),
  importHousehold: (...a: unknown[]) => importHousehold(...a),
}));
vi.mock('../firebase/hooks', () => ({ useSyncStatus: () => 'synced' }));

const updateDevice = vi.fn();
const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, chores: [],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice,
};
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Settings /></HouseholdContext.Provider>);

test('backupFileName', () => {
  expect(backupFileName(new Date(2026, 9, 9))).toBe('responsible-2gether-backup-2026-10-09.json');
});

test('shows code, sync status and export reminder', () => {
  renderIt();
  expect(screen.getByText('tidy-otter-maple-4821')).toBeInTheDocument();
  expect(screen.getByText(/Synced/)).toBeInTheDocument();
  expect(screen.getByText(/haven’t exported a backup/)).toBeInTheDocument();
});

test('switching who this device is', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('radio', { name: 'Sam' }));
  expect(updateDevice).toHaveBeenCalledWith({ me: 'b' });
});

test('renaming a member saves on blur', async () => {
  renderIt();
  const input = screen.getByLabelText('Person 2 name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Samira');
  await userEvent.tab();
  expect(updateMembers).toHaveBeenCalledWith('tidy-otter-maple-4821', { a: { name: 'Iman' }, b: { name: 'Samira' } });
});

test('rejects an invalid import file', async () => {
  renderIt();
  const file = new File(['{"version": 9}'], 'bad.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/Import backup/), file);
  expect(await screen.findByText(/Unsupported backup version/)).toBeInTheDocument();
  expect(importHousehold).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/Settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/screens/Settings.tsx`:
```tsx
import { useState, type ChangeEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useSyncStatus } from '../firebase/hooks';
import { exportHousehold, importHousehold, updateMembers } from '../firebase/repo';
import { validateBackup } from '../domain/backup';
import { exportReminderDue } from '../device';
import { MEMBER_IDS, type MemberId } from '../domain/types';

const pad = (n: number) => String(n).padStart(2, '0');
export const backupFileName = (d: Date) =>
  `responsible-2gether-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

const SYNC_LABEL = { synced: '● Synced', saving: '◌ Saving…', offline: '○ Offline — changes will sync later' };

export function Settings() {
  const { code, me, members, device, updateDevice } = useHousehold();
  const sync = useSyncStatus(code);
  const [names, setNames] = useState({ a: members.a.name, b: members.b.name });
  const [msg, setMsg] = useState<string | null>(null);
  const link = `${location.origin}${import.meta.env.BASE_URL}#join=${code}`;

  const saveName = (m: MemberId) => {
    const n = names[m].trim().slice(0, 30);
    if (!n) return setNames((s) => ({ ...s, [m]: members[m].name }));
    if (n !== members[m].name) void updateMembers(code, { ...members, [m]: { name: n } });
  };

  async function share() {
    const text = `Join our Responsible 2gether household: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Responsible 2gether', text, url: link });
      else { await navigator.clipboard.writeText(link); setMsg('Link copied.'); }
    } catch { /* share sheet dismissed */ }
  }

  async function doExport() {
    setMsg('Exporting…');
    try {
      const backup = await exportHousehold(code);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: backupFileName(new Date()) });
      a.click();
      URL.revokeObjectURL(url);
      updateDevice({ lastExportAt: Date.now() });
      setMsg('Backup downloaded. Keep it somewhere safe (e.g. iCloud Drive / Google Drive).');
    } catch {
      setMsg('Export failed. Are you online?');
    }
  }

  async function doImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { return setMsg('That file isn’t valid JSON.'); }
    const r = validateBackup(parsed);
    if (!r.ok) return setMsg(r.error);
    if (!confirm(`Replace ALL data in this household with the backup from ${new Date(r.backup.exportedAt).toLocaleString()}?`)) return;
    setMsg('Importing…');
    try { await importHousehold(code, r.backup); setMsg('Backup restored.'); }
    catch { setMsg('Import failed. Are you online?'); }
  }

  return (
    <main className="page">
      <h1>Settings</h1>

      <h2>This phone belongs to</h2>
      <div className="kind-toggle" role="radiogroup" aria-label="This phone belongs to">
        {MEMBER_IDS.map((m) => (
          <button key={m} role="radio" aria-checked={me === m} className={me === m ? 'on plus' : ''} onClick={() => updateDevice({ me: m })}>{members[m].name}</button>
        ))}
      </div>

      <h2>Names</h2>
      <div className="card stack">
        {MEMBER_IDS.map((m, i) => (
          <label key={m}>Person {i + 1} name
            <input value={names[m]} maxLength={30} onChange={(e) => setNames((s) => ({ ...s, [m]: e.target.value }))} onBlur={() => saveName(m)} />
          </label>
        ))}
      </div>

      <h2>Household</h2>
      <div className="card stack">
        <div>Code: <code className="code">{code}</code></div>
        <button className="btn" onClick={share}>Share join link</button>
        <div className={`sync sync-${sync}`}>{SYNC_LABEL[sync]}</div>
      </div>

      <h2>Backup</h2>
      <div className="card stack">
        {exportReminderDue(device.lastExportAt, Date.now()) && (
          <p className="notice">You haven’t exported a backup in the last 30 days.</p>
        )}
        {device.lastExportAt && <p className="muted small">Last export from this phone: {new Date(device.lastExportAt).toLocaleDateString()}</p>}
        <button className="btn primary" onClick={doExport}>Export backup (JSON)</button>
        <label className="btn file">Import backup…
          <input type="file" accept="application/json,.json" onChange={doImport} className="sr-only" />
        </label>
        {msg && <p className="muted small" role="status">{msg}</p>}
      </div>

      <h2>Danger zone</h2>
      <button className="btn danger" onClick={() => {
        if (confirm('Remove this household from this phone? Data stays in the cloud; you can rejoin with the code.')) updateDevice({ code: null, me: null });
      }}>Leave household on this phone</button>
    </main>
  );
}
```

Append to `src/styles.css`:
```css
.code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--bg); padding: 2px 6px; border-radius: 6px; user-select: all; }
.sync { font-size: .9rem; }
.sync-synced { color: hsl(174 60% 40%); }
.sync-saving { color: var(--muted); }
.sync-offline { color: var(--warn-text); }
.btn.file { flex-direction: row; justify-content: center; color: var(--text); font-size: 1rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npm test`
Expected: all pass. (jsdom lacks `URL.createObjectURL`; it is only called by export, which isn't exercised in tests.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: settings tab with identity, sharing, sync status and JSON backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Deploy pipeline and README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `npm run build` output in `dist/`.

- [ ] **Step 1: GitHub Pages workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README**

`README.md`:
````markdown
# Responsible 2gether

A tiny PWA for two people sharing a home: weekly chore shares, helpfulness
feedback, and a to-do list. Free to run (Firebase Spark + GitHub Pages), no
logins — each phone just remembers who's holding it.

Design: `docs/superpowers/specs/2026-10-09-responsible-2gether-design.md`

## One-time setup

1. **Firebase** (console.firebase.google.com)
   - Create a project (Spark/free plan; Google Analytics off).
   - Build → Authentication → Sign-in method → enable **Anonymous**.
   - Build → Firestore Database → Create database (production mode, region near you, e.g. `eur3`).
   - Project settings → Your apps → add a **Web** app → copy the config object into `src/firebase/config.ts` (replace the `REPLACE_ME` values).
   - Deploy the security rules:
     ```bash
     npx firebase login
     npx firebase deploy --only firestore:rules --project <your-project-id>
     ```
2. **GitHub Pages**
   - Create a repo named `responsible-2gether` on your personal GitHub and push `main`.
   - Repo Settings → Pages → Source: **GitHub Actions**. The workflow deploys on every push to `main`.
   - Firebase console → Authentication → Settings → Authorised domains → add `<your-user>.github.io`.
3. **Phones**
   - Open `https://<your-user>.github.io/responsible-2gether/`.
   - iPhone: Share → *Add to Home Screen*. Android: menu → *Install app*.
   - Phone 1: *Create our household*. Settings → *Share join link* → send to phone 2.

## Development

Requires Node 22+ and Java 17 for the emulator:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
npm install
npm test            # unit + component tests
npm run test:rules  # Firestore rules against the emulator
npm run emulators   # terminal 1: local Auth + Firestore
npm run dev:emu     # terminal 2: app against the emulator
```

## Backups

Data lives in Firestore and each phone keeps an offline copy. Settings →
*Export backup* downloads a JSON file of everything; *Import backup* restores
one (replacing current data). The app nudges you if no export happened in 30
days.
````

- [ ] **Step 3: Verify build**

Run: `npm test && npm run build`
Expected: tests pass; `dist/` built.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: GitHub Pages deploy workflow and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: End-to-end verification against the emulator

**Files:** none created unless fixes are needed (each fix gets its own commit with a `fix:` message).

- [ ] **Step 1: Start emulator and app**

Terminal 1:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
npm run emulators
```
Terminal 2: `npm run dev:emu` (serves at `http://localhost:5173/responsible-2gether/`).

- [ ] **Step 2: Walk the flows at phone width (375×812), in two browser tabs/profiles to simulate two phones**

Check each, fixing anything broken:
1. Tab A: Create household (names "Iman", "Sam") → pick "Iman" → Home shows empty donut "Nothing done yet", both helpfulness bars 100%.
2. Tab A: Settings shows code; copy the join link. Tab B (separate browser profile or incognito so localStorage differs): open link → Join → pick "Sam".
3. Tab A: To-do lists only Iman's 7 chores; set Cooking to 100% → Tab B's Home donut updates live with an Iman-coloured Cooking slice and grey remainder.
4. Tab B: Feedback → − "Plate on sofa" → warning shows (0 plus vs 1 minus). Tab A: To-do shows the checkbox task; Home shows Iman helpfulness 90%.
5. Tab B: two + feedback → warning disappears. Tab A: Home "Kind words" shows both.
6. Tab A: Setup → reassign a chore, change hours, add "Vacuum", remove "Cleaning the fridge" → totals update on both tabs.
7. Home ‹ goes to last week (empty, read-only); › disabled on current week.
8. Settings → Export downloads JSON; Import the same file → data intact.
9. DevTools → Network offline → toggle a completion → Settings shows Offline; back online → Synced and other tab updates.
10. Dark mode (emulate `prefers-color-scheme: dark`) is legible; no horizontal scroll at 375 px.

- [ ] **Step 3: Production build + PWA check**

Run: `npm run build && npx vite preview` and confirm in DevTools → Application that the manifest is valid and the service worker is active.

- [ ] **Step 4: Final full test run**

Run: `npm test && npm run test:rules`
Expected: all pass.
