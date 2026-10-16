import type { Chore, ChoreLog, Completion, MemberId } from './types';
import { MEMBER_IDS } from './types';
import { choresForWeek, donutSlices, memberHours, sharePercents, type DonutSlice } from './scoring';

export type WeekMode = 'blocks' | 'legacy' | 'mixed';

// Weeks rated with percentages before blocks existed keep their ratings: 'mixed' when logs arrive mid-week.
export const weekMode = (logs: ChoreLog[], completions: Completion[]): WeekMode => {
  if (completions.length === 0) return 'blocks';
  return logs.length === 0 ? 'legacy' : 'mixed';
};

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
  const mode = weekMode(logs, completions);
  if (mode === 'blocks') {
    return { mode: 'blocks', slices: blockSlices(logs), pct: minuteShares(logs), done: memberMinutes(logs), planned: null };
  }
  const views = choresForWeek(weekId, chores, completions, isCurrent);
  const h = memberHours(views);
  const toMin = (hours: number) => Math.round(hours * 60);
  if (mode === 'mixed') {
    const rated = donutSlices(views)
      .filter((s) => s.key !== 'notdone')
      .map((s) => ({ ...s, key: `rated:${s.key}`, value: toMin(s.value) }));
    const blocks = blockSlices(logs);
    const slices: DonutSlice[] = [];
    for (const m of MEMBER_IDS) {
      const mine = [...blocks.filter((s) => s.member === m), ...rated.filter((s) => s.member === m)];
      mine.forEach((s, i) => slices.push({ ...s, shadeIndex: i, shadeCount: mine.length }));
    }
    const logged = memberMinutes(logs);
    const a = toMin(h.a) + logged.a;
    const b = toMin(h.b) + logged.b;
    const total = a + b;
    const pa = total === 0 ? 0 : Math.round((a / total) * 100);
    return { mode, slices, pct: total === 0 ? { a: 0, b: 0 } : { a: pa, b: 100 - pa }, done: { a, b, total }, planned: null };
  }
  return {
    mode: 'legacy',
    slices: donutSlices(views).map((s) => ({ ...s, value: toMin(s.value) })),
    pct: sharePercents(views),
    done: { a: toMin(h.a), b: toMin(h.b), total: toMin(h.done) },
    planned: toMin(h.total),
  };
}
