# Khooneh Phase 1 — Rename, Navigation and Home Command Centre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the chores-only app into the Khooneh shell: renamed with a new icon, four top-level tabs, the existing chores screens grouped as the Tidy Together module, and a Home command centre.

**Architecture:**
- `App.tsx` keeps a `NavTarget` (`tab` + optional chores `section`) and passes `onNavigate` to Home.
- `ChoresModule` wraps the four existing chores screens (Dashboard, Todo, Feedback, Config) behind a segmented control. Those screens are untouched apart from moving the backup notice to Home.
- `Home` reads the current week via the existing `useWeek` hook and the existing scoring functions.

**Tech Stack:** Vite + React 19 + TypeScript 7, Vitest + Testing Library, vite-plugin-pwa, `@vite-pwa/assets-generator`.

**Spec:** `docs/superpowers/specs/2026-10-16-family-command-center-design.md` (§4 Information architecture, §5.1 Home, §7.1 and §7.5)

## Global Constraints

- App name **Khooneh**: manifest `name` and `short_name` are both `Khooneh`; the iOS title is `Khooneh`.
- Module names:
  - **Tidy Together** 🧺 (chores)
  - **Pocket Money** 👛 (money; "coming soon" in this phase)
  - **Piggy Bank** 🐷 (not shown in this phase)
- Tab order: **Home | Chores | Money | Settings**. Home is emphasised (the existing `tab-center` style) and is the default tab.
- Chores sub-sections, in order: **This week | To-do | Feedback | Setup**.
- Keep the origin, data, reminders, push files and backup file names unchanged.
- 44 px minimum touch targets. 16 px gutters. No horizontal scroll at 375 px. Light and dark themes via existing CSS tokens.
- Commits: conventional style, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/khooneh-shell`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `public/icon.svg` + generated PNGs/ICO | modify / regenerate | New Khooneh icon |
| `vite.config.ts`, `index.html` | modify | Manifest and iOS name |
| `src/screens/Onboarding.tsx`, `src/screens/SetupNeeded.tsx`, `src/screens/Settings.tsx` | modify | User-visible product name |
| `src/App.test.tsx` | modify | Expect the new name |
| `src/navigation.ts` | create | `TabId`, `ChoresSection`, `NavTarget` types + `CHORES_SECTIONS` |
| `src/components/TabBar.tsx` (+ test) | modify | Four tabs |
| `src/components/icons.tsx` | modify | Add `IconHome`, `IconBasket`, `IconWallet` |
| `src/screens/ChoresModule.tsx` (+ test) | create | Segmented sub-nav hosting the existing chores screens |
| `src/screens/MoneySoon.tsx` | create | Pocket Money placeholder |
| `src/screens/Home.tsx` (+ test) | create | Command centre |
| `src/screens/Dashboard.tsx` (+ test) | modify | Remove the backup notice (moved to Home) |
| `src/App.tsx` | modify | Navigation wiring |
| `src/styles.css` | modify | Segmented control, Home layout, 4-column tab bar |

---

### Task 1: Rename to Khooneh with a new icon

**Files:**
- Modify: `public/icon.svg`, `vite.config.ts` (manifest `name`, `short_name`, `description`), `index.html` (`<title>`, `apple-mobile-web-app-title`), `src/screens/Onboarding.tsx:57`, `src/screens/SetupNeeded.tsx:4`, `src/screens/Settings.tsx:21,64,66`
- Regenerate: `public/pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico` (via `npm run icons`)
- Test: `src/App.test.tsx`

**Interfaces:** none consumed or produced.

- [ ] **Step 1: Update the failing test first**

In `src/App.test.tsx`, change the expected heading name from `'Responsible 2gether'` to `'Khooneh'`:

```tsx
test('shows setup instructions when Firebase is not configured', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Khooneh' })).toBeInTheDocument();
  expect(screen.getByText(/Firebase isn’t configured yet/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no heading named "Khooneh".

- [ ] **Step 3: Rename strings**

- `src/screens/SetupNeeded.tsx`: `<h1>Responsible 2gether</h1>` → `<h1>Khooneh</h1>`
- `src/screens/Onboarding.tsx`: `<h1>Responsible 2gether</h1>` → `<h1>Khooneh</h1>`. Keep the existing tagline paragraph below it.
- `src/screens/Settings.tsx`:
  - `title: 'Responsible 2gether backup'` → `title: 'Khooneh backup'`
  - `` `Join our Responsible 2gether household: ${link}` `` → `` `Join our Khooneh household: ${link}` ``
  - `{ title: 'Responsible 2gether', text, url: link }` → `{ title: 'Khooneh', text, url: link }`
  - Keep `backupFileName` (`responsible-2gether-backup-…json`) unchanged so old and new backups sort together.
- `index.html`: `<title>Khooneh</title>` and `<meta name="apple-mobile-web-app-title" content="Khooneh" />`
- `vite.config.ts` manifest: `name: 'Khooneh'`, `short_name: 'Khooneh'`, `description: 'Our home, together: chores and pocket money.'`

If any existing test asserts the old share text or title, update the expectation to the new string.

- [ ] **Step 4: New icon**

Replace `public/icon.svg` with this coral house and teal heart door on cream. It's a single bold silhouette that reads at 60 pt:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#fbf3e8"/>
  <path d="M256 92 L430 236 Q440 245 430 256 L404 256 L404 404 Q404 420 388 420 L124 420 Q108 420 108 404 L108 256 L82 256 Q72 245 82 236 Z" fill="#ef6a4c"/>
  <path d="M256 268c-14-26-58-24-58 12 0 30 34 52 58 74 24-22 58-44 58-74 0-36-44-38-58-12z" fill="#0f766e"/>
</svg>
```

Run: `npm run icons`
Expected: the six generated files in `public/` are rewritten (check that `git status` lists them as modified).

- [ ] **Step 5: Verify**

Run: `npx vitest run src/App.test.tsx && npm test && npm run build && grep -o '"name":"[^"]*","short_name":"[^"]*"' dist/manifest.webmanifest`
Expected: tests pass; manifest prints `"name":"Khooneh","short_name":"Khooneh"`.

- [ ] **Step 6: Commit**

```bash
git add -A public src index.html vite.config.ts
git commit -m "feat: rename the app to Khooneh with a new house icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Four-tab navigation and the Tidy Together module

**Files:**
- Create: `src/navigation.ts`, `src/screens/ChoresModule.tsx`, `src/screens/ChoresModule.test.tsx`, `src/screens/MoneySoon.tsx`
- Modify: `src/components/TabBar.tsx`, `src/components/TabBar.test.tsx`, `src/components/icons.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Produces (`src/navigation.ts`):
  ```ts
  export type TabId = 'home' | 'chores' | 'money' | 'settings';
  export type ChoresSection = 'week' | 'todo' | 'feedback' | 'setup';
  export interface NavTarget { tab: TabId; section?: ChoresSection }
  export const CHORES_SECTIONS: { id: ChoresSection; label: string }[];
  ```
- Produces: `ChoresModule({ section, onSection }: { section: ChoresSection; onSection(s: ChoresSection): void })`, `MoneySoon()`, `TabBar({ active, onChange }: { active: TabId; onChange(t: TabId): void })`
- Consumes: existing `Dashboard`, `Todo`, `Feedback`, `Config` screens (no props).
- Task 3 adds `Home`. In this task, `App` renders a temporary `Home` stand-in only if needed to compile. Prefer making the `home` tab render `<Dashboard />` until Task 3 replaces it.

- [ ] **Step 1: Navigation types**

`src/navigation.ts`:

```ts
export type TabId = 'home' | 'chores' | 'money' | 'settings';
export type ChoresSection = 'week' | 'todo' | 'feedback' | 'setup';

export interface NavTarget {
  tab: TabId;
  section?: ChoresSection;
}

export const CHORES_SECTIONS: { id: ChoresSection; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'todo', label: 'To-do' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'setup', label: 'Setup' },
];
```

- [ ] **Step 2: Failing TabBar test**

Replace `src/components/TabBar.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';

test('four tabs in order, Home emphasised and current', () => {
  render(<TabBar active="home" onChange={() => {}} />);
  const nav = screen.getByRole('navigation', { name: 'Sections' });
  const buttons = within(nav).getAllByRole('button');
  expect(buttons.map((b) => b.textContent)).toEqual(['Home', 'Chores', 'Money', 'Settings']);
  expect(buttons[0]).toHaveAttribute('aria-current', 'page');
  expect(buttons[0]).toHaveClass('tab-center');
  expect(buttons[1]).not.toHaveAttribute('aria-current');
});

test('clicking a tab reports it', async () => {
  const onChange = vi.fn();
  render(<TabBar active="home" onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Money' }));
  expect(onChange).toHaveBeenCalledWith('money');
});
```

Run: `npx vitest run src/components/TabBar.test.tsx`
Expected: FAIL (old labels).

- [ ] **Step 3: Icons + TabBar**

Append to `src/components/icons.tsx` (same `base` props as the existing icons):

```tsx
export const IconHome = () => (<svg {...base}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>);
export const IconBasket = () => (<svg {...base}><path d="M4 9h16l-1.5 10.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z" /><path d="M8 9l3-5M16 9l-3-5" /></svg>);
export const IconWallet = () => (<svg {...base}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="15" r="1.2" /></svg>);
```

Replace `src/components/TabBar.tsx`:

```tsx
import type { ReactElement } from 'react';
import type { TabId } from '../navigation';
import { IconBasket, IconGear, IconHome, IconWallet } from './icons';

export type { TabId } from '../navigation';

export const TABS: { id: TabId; label: string; icon: () => ReactElement }[] = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'chores', label: 'Chores', icon: IconBasket },
  { id: 'money', label: 'Money', icon: IconWallet },
  { id: 'settings', label: 'Settings', icon: IconGear },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-current={active === id ? 'page' : undefined}
          className={`tab${id === 'home' ? ' tab-center' : ''}`}
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

In `src/styles.css`, change `.tabbar`'s `grid-template-columns: repeat(5, 1fr)` to `repeat(4, 1fr)`.

Run: `npx vitest run src/components/TabBar.test.tsx`
Expected: PASS.

- [ ] **Step 4: Failing ChoresModule test**

`src/screens/ChoresModule.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoresModule } from './ChoresModule';

vi.mock('./Dashboard', () => ({ Dashboard: () => <p>week screen</p> }));
vi.mock('./Todo', () => ({ Todo: () => <p>todo screen</p> }));
vi.mock('./Feedback', () => ({ Feedback: () => <p>feedback screen</p> }));
vi.mock('./Config', () => ({ Config: () => <p>setup screen</p> }));

test('shows the Tidy Together title and the four sections in order', () => {
  render(<ChoresModule section="week" onSection={() => {}} />);
  expect(screen.getByRole('heading', { name: /Tidy Together/ })).toBeInTheDocument();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => t.textContent)).toEqual(['This week', 'To-do', 'Feedback', 'Setup']);
  expect(screen.getByRole('tab', { name: 'This week' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('week screen')).toBeInTheDocument();
});

test('renders the requested section', () => {
  render(<ChoresModule section="todo" onSection={() => {}} />);
  expect(screen.getByText('todo screen')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'chores-tab-todo');
});

test('choosing a section reports it', async () => {
  const onSection = vi.fn();
  render(<ChoresModule section="week" onSection={onSection} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
  expect(onSection).toHaveBeenCalledWith('feedback');
});

test('arrow keys move between sections', async () => {
  const onSection = vi.fn();
  render(<ChoresModule section="week" onSection={onSection} />);
  screen.getByRole('tab', { name: 'This week' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onSection).toHaveBeenCalledWith('todo');
  await userEvent.keyboard('{ArrowLeft}');
  expect(onSection).toHaveBeenLastCalledWith('setup');
});
```

Note on the last test: the component is controlled, so `section` stays `'week'`. ArrowRight from `week` reports `todo`, and ArrowLeft from `week` wraps to `setup`.

Run: `npx vitest run src/screens/ChoresModule.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 5: ChoresModule + MoneySoon**

`src/screens/ChoresModule.tsx`:

```tsx
import type { KeyboardEvent, ReactElement } from 'react';
import { CHORES_SECTIONS, type ChoresSection } from '../navigation';
import { Dashboard } from './Dashboard';
import { Todo } from './Todo';
import { Feedback } from './Feedback';
import { Config } from './Config';

const SECTION_SCREENS: Record<ChoresSection, () => ReactElement> = {
  week: Dashboard, todo: Todo, feedback: Feedback, setup: Config,
};

export function ChoresModule({ section, onSection }: { section: ChoresSection; onSection(s: ChoresSection): void }) {
  const Screen = SECTION_SCREENS[section];
  const index = CHORES_SECTIONS.findIndex((s) => s.id === section);

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = CHORES_SECTIONS[(index + step + CHORES_SECTIONS.length) % CHORES_SECTIONS.length];
    onSection(next.id);
    document.getElementById(`chores-tab-${next.id}`)?.focus();
  }

  return (
    <div className="module">
      <header className="module-head">
        <h1>🧺 Tidy Together</h1>
        <div className="segmented-nav" role="tablist" aria-label="Tidy Together sections" onKeyDown={onKeyDown}>
          {CHORES_SECTIONS.map((s) => (
            <button
              key={s.id}
              id={`chores-tab-${s.id}`}
              role="tab"
              aria-selected={s.id === section}
              aria-controls="chores-panel"
              tabIndex={s.id === section ? 0 : -1}
              onClick={() => onSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>
      <div id="chores-panel" role="tabpanel" aria-labelledby={`chores-tab-${section}`}>
        <Screen />
      </div>
    </div>
  );
}
```

`src/screens/MoneySoon.tsx`:

```tsx
export function MoneySoon() {
  return (
    <main className="page">
      <h1>👛 Pocket Money</h1>
      <div className="card stack">
        <p><strong>Coming soon.</strong></p>
        <p className="muted">Personal monthly allowances broken into today, this week and this month, a five-second purchase entry, and a Piggy Bank for whatever you save.</p>
      </div>
    </main>
  );
}
```

Append to `src/styles.css`:

```css
.module-head { max-width: 560px; margin: 0 auto; padding: 20px 16px 0; }
.module-head h1 { margin-bottom: 10px; }
.segmented-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 4px; }
.segmented-nav button { min-height: 40px; border: 0; border-radius: 9px; background: none; color: var(--muted); font-size: .85rem; font-weight: 600; cursor: pointer; padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.segmented-nav button[aria-selected="true"] { background: var(--accent); color: var(--on-accent); }
.segmented-nav button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.module #chores-panel > .page { padding-top: 12px; }
```

The sub-screens keep their own `<h1>`s ("To-do", "Feedback", "Chores setup"). The Dashboard has no `<h1>`. That's acceptable for this phase.

Run: `npx vitest run src/screens/ChoresModule.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire App**

In `src/App.tsx`:

- Replace imports of `Dashboard`, `Todo`, `Feedback`, `Config` and the `SCREENS` record with:
  ```tsx
  import { ChoresModule } from './screens/ChoresModule';
  import { MoneySoon } from './screens/MoneySoon';
  import { Dashboard } from './screens/Dashboard';
  import type { ChoresSection, NavTarget, TabId } from './navigation';
  ```
  and import `TabBar` only (its `TabId` re-export is no longer needed here).
- Inside `Household`, replace `const [tab, setTab] = useState<TabId>('dashboard');` with:
  ```tsx
  const [tab, setTab] = useState<TabId>('home');
  const [choresSection, setChoresSection] = useState<ChoresSection>('week');
  const navigate = useCallback((t: NavTarget) => {
    setTab(t.tab);
    if (t.section) setChoresSection(t.section);
    window.scrollTo(0, 0);
  }, []);
  ```
- Replace `const Screen = SCREENS[tab];` and `<Screen />` with:
  ```tsx
  const screen =
    tab === 'chores' ? <ChoresModule section={choresSection} onSection={setChoresSection} />
    : tab === 'money' ? <MoneySoon />
    : tab === 'settings' ? <Settings />
    : <Dashboard />; // replaced by <Home onNavigate={navigate} /> in Task 3
  ```
  Render `{screen}` where `<Screen />` was, and pass `onChange={(t) => navigate({ tab: t })}` to `TabBar`.
- `navigate` is unused until Task 3. To satisfy `noUnusedLocals`, it's referenced by the `TabBar` `onChange` above.

- [ ] **Step 7: Verify everything**

Run: `npx tsc --noEmit && npm test`
Expected: all tests pass. The old TabBar expectations are replaced; other screen tests are untouched.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: Home/Chores/Money/Settings tabs with Tidy Together sub-sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Home command centre

**Files:**
- Create: `src/screens/Home.tsx`, `src/screens/Home.test.tsx`
- Modify: `src/App.tsx` (render Home), `src/screens/Dashboard.tsx` + `src/screens/Dashboard.test.tsx` (remove the backup notice), `src/styles.css`

**Interfaces:**
- Consumes:
  - `NavTarget` from `src/navigation.ts`
  - `useHousehold()` → `{ code, me, members, chores, currentWeekId, device }`
  - `useWeek(code, weekId)` → `{ completions, feedback }`
  - `choresForWeek(weekId, chores, completions, isCurrent)`, `sharePercents(views)` → `{ a, b }`, `memberHours(views)` → `{ a, b, done, total }`
  - `other(m)`, `memberColor(m)`, `exportReminderDue(lastExportAt, now)`
- Produces: `Home({ onNavigate }: { onNavigate(t: NavTarget): void })`

- [ ] **Step 1: Failing Home test**

`src/screens/Home.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { Completion, Feedback } from '../domain/types';
import { Home } from './Home';

let completions: Completion[] = [];
let feedback: Feedback[] = [];
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading: false, completions, feedback }) }));

const ctx = (over: Partial<HouseholdCtx> = {}): HouseholdCtx => ({
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 6, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 4, assignee: 'b', createdAt: 1, archivedAt: null },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
  ...over,
});
const renderHome = (onNavigate = vi.fn(), over: Partial<HouseholdCtx> = {}) => {
  render(<HouseholdContext.Provider value={ctx(over)}><Home onNavigate={onNavigate} /></HouseholdContext.Provider>);
  return onNavigate;
};

beforeEach(() => { completions = []; feedback = []; });

test('greets the person on this phone under the Khooneh title', () => {
  renderHome();
  expect(screen.getByRole('heading', { level: 1, name: 'Khooneh' })).toBeInTheDocument();
  expect(screen.getByText('Hi Iman')).toBeInTheDocument();
});

test('Tidy Together card shows this week’s split with "You" first', () => {
  completions = [
    { choreId: 'c1', percent: 100, name: 'Cooking', hours: 6, assignee: 'a', updatedAt: 1 },
    { choreId: 'c2', percent: 100, name: 'Trash', hours: 4, assignee: 'b', updatedAt: 1 },
  ];
  renderHome();
  expect(screen.getByText('You 60% · Tahereh 40%')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'You 60%, Tahereh 40%' })).toBeInTheDocument();
});

test('Tidy Together card says nothing logged when the week is empty', () => {
  renderHome();
  expect(screen.getByText('Nothing logged yet this week')).toBeInTheDocument();
});

test('＋ Chore and the Tidy Together card navigate into the chores module', async () => {
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: '＋ Chore' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'todo' });
  await userEvent.click(screen.getByRole('button', { name: /Tidy Together/ }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'week' });
});

test('Pocket Money card is marked coming soon and opens the Money tab', async () => {
  const nav = renderHome();
  const card = screen.getByRole('button', { name: /Pocket Money/ });
  expect(card).toHaveTextContent(/Coming soon/);
  await userEvent.click(card);
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money' });
});

test('unresolved negative feedback for me shows an alert that opens To-do', async () => {
  feedback = [
    { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plates', createdAt: 1, resolved: false },
    { id: 'f2', from: 'b', to: 'a', kind: 'minus', text: 'Towels', createdAt: 2, resolved: false },
    { id: 'f3', from: 'b', to: 'a', kind: 'minus', text: 'Done', createdAt: 3, resolved: true },
    { id: 'f4', from: 'a', to: 'b', kind: 'minus', text: 'Not mine', createdAt: 4, resolved: false },
  ];
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: '2 feedback notes to act on ›' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'todo' });
});

test('no feedback alert when nothing is pending', () => {
  renderHome();
  expect(screen.queryByText(/to act on/)).toBeNull();
});

test('singular wording for one pending note', () => {
  feedback = [{ id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plates', createdAt: 1, resolved: false }];
  renderHome();
  expect(screen.getByRole('button', { name: '1 feedback note to act on ›' })).toBeInTheDocument();
});

test('backup reminder appears on Home when an export is overdue and opens Settings', async () => {
  const nav = renderHome(vi.fn(), { device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null } });
  await userEvent.click(screen.getByRole('button', { name: 'Back up your data ›' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'settings' });
});
```

Run: `npx vitest run src/screens/Home.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement Home**

`src/screens/Home.tsx`:

```tsx
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { choresForWeek, memberHours, sharePercents } from '../domain/scoring';
import { other } from '../domain/types';
import { exportReminderDue } from '../device';
import { memberColor } from '../components/colors';
import type { NavTarget } from '../navigation';

export function Home({ onNavigate }: { onNavigate(t: NavTarget): void }) {
  const { code, me, members, chores, currentWeekId, device } = useHousehold();
  const { completions, feedback } = useWeek(code, currentWeekId);
  const partner = other(me);

  const views = choresForWeek(currentWeekId, chores, completions, true);
  const pct = sharePercents(views);
  const { done } = memberHours(views);
  const toActOn = feedback.filter((f) => f.kind === 'minus' && f.to === me && !f.resolved).length;
  const split = `You ${pct[me]}% · ${members[partner].name} ${pct[partner]}%`;

  return (
    <main className="page home">
      <header className="home-head">
        <h1>Khooneh</h1>
        <p className="muted">Hi {members[me].name}</p>
      </header>

      {toActOn > 0 && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          {toActOn} feedback note{toActOn === 1 ? '' : 's'} to act on ›
        </button>
      )}
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'settings' })}>
          Back up your data ›
        </button>
      )}

      <div className="home-actions">
        <button className="btn primary big" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          ＋ Chore
        </button>
      </div>

      <button className="card module-card" onClick={() => onNavigate({ tab: 'chores', section: 'week' })}>
        <span className="module-card-title">🧺 Tidy Together <span aria-hidden="true">›</span></span>
        {done === 0 ? (
          <span className="muted">Nothing logged yet this week</span>
        ) : (
          <>
            <span>{split}</span>
            <span className="split-bar" role="img" aria-label={`You ${pct[me]}%, ${members[partner].name} ${pct[partner]}%`}>
              <span style={{ width: `${pct[me]}%`, background: memberColor(me) }} />
              <span style={{ width: `${pct[partner]}%`, background: memberColor(partner) }} />
            </span>
          </>
        )}
      </button>

      <button className="card module-card" onClick={() => onNavigate({ tab: 'money' })}>
        <span className="module-card-title">👛 Pocket Money <span aria-hidden="true">›</span></span>
        <span className="muted">Coming soon: allowances, purchases and your Piggy Bank.</span>
      </button>
    </main>
  );
}
```

Append to `src/styles.css`:

```css
.home-head { margin-bottom: 12px; }
.home-head h1 { margin: 0; }
.home-head p { margin: 2px 0 0; }
.notice-action { display: block; width: 100%; text-align: start; border: 0; font: inherit; cursor: pointer; min-height: 44px; }
.home-actions { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 8px 0 16px; }
.home-actions .btn.big { min-height: 52px; }
.module-card { display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: start; font: inherit; color: var(--text); cursor: pointer; margin-bottom: 12px; }
.module-card-title { display: flex; justify-content: space-between; font-weight: 700; font-size: 1.05rem; }
.split-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--slice-empty); }
.split-bar > span { display: block; height: 100%; }
```

Run: `npx vitest run src/screens/Home.test.tsx`
Expected: PASS.

- [ ] **Step 3: Move the backup notice off the Dashboard**

In `src/screens/Dashboard.tsx`, delete the block:

```tsx
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <p className="notice">Back up your data: Settings › Export.</p>
      )}
```

Also remove the now-unused `exportReminderDue` import and `device` from the `useHousehold()` destructuring. If `src/screens/Dashboard.test.tsx` asserts that notice, remove that assertion. Its fixture's `device` field can stay, because the context type still has it.

- [ ] **Step 4: Render Home in App**

In `src/App.tsx`:
- Replace the `<Dashboard />` fallback in the `screen` expression with `<Home onNavigate={navigate} />`.
- Replace the `Dashboard` import with `import { Home } from './screens/Home';`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: Home command centre with Tidy Together and Pocket Money cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Phone-size check and deploy (controller)

- [ ] Run against the emulator:
  ```bash
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
  npm run emulators
  npm run dev:emu
  ```
  Check at 375 × 812, light and dark:
  - Home shows the greeting, ＋ Chore, the Tidy Together card (split after rating a chore), and the Pocket Money "coming soon" card.
  - Tabs read Home / Chores / Money / Settings.
  - Chores sub-sections switch, and To-do rating still works.
  - Settings still has Reminders.
  - No horizontal scroll.
- [ ] Merge `feat/khooneh-shell` → `main` (fast-forward), then `npm run deploy` and `git push origin main`.
- [ ] Check https://2gether.imansaraei.com serves a manifest with `"name":"Khooneh"`.
