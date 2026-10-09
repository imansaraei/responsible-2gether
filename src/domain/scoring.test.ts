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
