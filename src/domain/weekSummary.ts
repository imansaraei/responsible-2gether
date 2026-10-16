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
