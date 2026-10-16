import { planLogWrites, validateBackup, type Backup } from './backup';

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
