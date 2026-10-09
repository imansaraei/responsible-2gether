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
