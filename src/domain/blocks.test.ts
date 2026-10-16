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

test('a chore named like an Object.prototype member gets the fallback', () => {
  expect(blockMinutesOf({ name: 'constructor' })).toBe(15);
});
