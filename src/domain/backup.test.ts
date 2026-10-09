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
