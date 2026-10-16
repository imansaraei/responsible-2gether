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

test('weekMode: legacy for completions only, mixed for both, blocks otherwise', () => {
  expect(weekMode([], [comp({})])).toBe('legacy');
  expect(weekMode([log({})], [comp({})])).toBe('mixed');
  expect(weekMode([log({})], [])).toBe('blocks');
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

test('summarizeWeek in mixed mode combines rated minutes with logged minutes', () => {
  const s = summarizeWeek('2026-W42', chores, [comp({ choreId: 'c1', percent: 50, hours: 6 })],
    [log({ by: 'a', minutes: 45 }), log({ by: 'b', choreId: 'c2', name: 'Trash', minutes: 75 })], true);
  expect(s.mode).toBe('mixed');
  expect(s.done).toEqual({ a: 225, b: 75, total: 300 });
  expect(s.pct).toEqual({ a: 75, b: 25 });
  expect(s.planned).toBeNull();
  expect(s.slices.find((x) => x.key === 'notdone')).toBeUndefined();
  const mineA = s.slices.filter((x) => x.member === 'a');
  expect(mineA.map((x) => x.key)).toEqual(['a:c1', 'rated:c1']);
  expect(mineA.find((x) => x.key === 'rated:c1')?.value).toBe(180);
  expect(mineA.map((x) => [x.shadeIndex, x.shadeCount])).toEqual([[0, 2], [1, 2]]);
  expect(s.slices.find((x) => x.key === 'b:c2')?.shadeCount).toBe(1);
});
