import { planLogWrites, stalePaths, validateBackup, type Backup } from './backup';

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
  ['slash in chore id', { ...good, chores: [{ ...good.chores[0], id: 'a/b' }] }],
  ['slash in completion choreId', { ...good, weeks: { '2026-W41': { ...good.weeks['2026-W41'], completions: [{ ...good.weeks['2026-W41'].completions[0], choreId: 'a/b' }] } } }],
  ['slash in feedback id', { ...good, weeks: { '2026-W41': { ...good.weeks['2026-W41'], feedback: [{ ...good.weeks['2026-W41'].feedback[0], id: 'a/b' }] } } }],
  ['bad feedback kind', { ...good, weeks: { '2026-W41': { ...good.weeks['2026-W41'], feedback: [{ ...good.weeks['2026-W41'].feedback[0], kind: 'meh' }] } } }],
])('rejects %s', (_label, input) => {
  const r = validateBackup(input);
  expect(r.ok).toBe(false);
});

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

test('planLogWrites skips logs that already exist (immutable) and keeps all paths', () => {
  expect(planLogWrites(['w/logs/a', 'w/logs/b'], new Set(['w/logs/a']))).toEqual(['w/logs/b']);
  expect(planLogWrites(['w/logs/a'], new Set())).toEqual(['w/logs/a']);
});

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

test('stalePaths deletes unkept docs but never settings or budgets', () => {
  const existing = ['households/c/chores/old', 'households/c/money/m1', 'households/c/money/m2', 'households/c/settings/app', 'households/c/budgets/home'];
  expect(stalePaths(existing, new Set(['households/c/money/m1']))).toEqual(['households/c/chores/old', 'households/c/money/m2']);
});
