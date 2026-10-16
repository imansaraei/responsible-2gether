import type { Chore, ChoreLog, Completion, Feedback, Members } from './types';
import { PERCENTS } from './types';
import { isValidCode } from './householdCode';

export interface Backup {
  version: 1;
  exportedAt: number;
  code: string;
  members: Members;
  chores: Chore[];
  weeks: Record<string, { completions: Completion[]; feedback: Feedback[]; logs?: ChoreLog[] }>;
}

type R = { ok: true; backup: Backup } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max;
const isId = (x: unknown) => isStr(x, 100) && !(x as string).includes('/');
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const isMember = (x: unknown) => x === 'a' || x === 'b';
const isHours = (x: unknown) => isNum(x) && (x as number) >= 0.25 && (x as number) <= 40;

const validChore = (c: unknown) =>
  isObj(c) && isId(c.id) && isStr(c.name, 60) && isHours(c.hours) && isMember(c.assignee) &&
  isNum(c.createdAt) && (c.archivedAt === null || isNum(c.archivedAt)) &&
  (c.blockMinutes === undefined || (Number.isInteger(c.blockMinutes) && (c.blockMinutes as number) >= 5 && (c.blockMinutes as number) <= 240 && (c.blockMinutes as number) % 5 === 0));

const validCompletion = (c: unknown) =>
  isObj(c) && isId(c.choreId) && PERCENTS.includes(c.percent as never) && isStr(c.name, 60) &&
  isHours(c.hours) && isMember(c.assignee) && isNum(c.updatedAt);

const validFeedback = (f: unknown) =>
  isObj(f) && isId(f.id) && isMember(f.from) && isMember(f.to) && f.from !== f.to &&
  (f.kind === 'plus' || f.kind === 'minus') && isStr(f.text, 280) && isNum(f.createdAt) &&
  typeof f.resolved === 'boolean';

const validLog = (l: unknown) =>
  isObj(l) && isId(l.id) && isId(l.choreId) && isStr(l.name, 60) && isMember(l.by) &&
  [1, 2, 3].includes(l.multiplier as number) && Number.isInteger(l.minutes) && (l.minutes as number) >= 5 && (l.minutes as number) <= 720 &&
  typeof l.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.day) && isNum(l.createdAt);

/** Logs are immutable (create-only in the rules), so an existing id already holds the same content: skip re-writing it. */
export const planLogWrites = (backupLogPaths: string[], existingPaths: Set<string>): string[] =>
  backupLogPaths.filter((p) => !existingPaths.has(p));

export function validateBackup(x: unknown): R {
  const fail = (error: string): R => ({ ok: false, error });
  if (!isObj(x)) return fail('Not a backup file.');
  if (x.version !== 1) return fail('Unsupported backup version.');
  if (typeof x.code !== 'string' || !isValidCode(x.code)) return fail('Backup has an invalid household code.');
  if (!isNum(x.exportedAt)) return fail('Backup is missing its export date.');
  const m = x.members;
  if (!isObj(m) || !isObj(m.a) || !isObj(m.b) || !isStr(m.a.name, 30) || !isStr(m.b.name, 30)) return fail('Backup has invalid member names.');
  if (!Array.isArray(x.chores) || !x.chores.every(validChore)) return fail('Backup has an invalid chore.');
  if (!isObj(x.weeks)) return fail('Backup is missing weeks.');
  for (const [weekId, w] of Object.entries(x.weeks)) {
    if (!/^\d{4}-W\d{2}$/.test(weekId)) return fail(`Invalid week "${weekId}".`);
    if (!isObj(w) || !Array.isArray(w.completions) || !Array.isArray(w.feedback)) return fail(`Week ${weekId} is malformed.`);
    if (!w.completions.every(validCompletion)) return fail(`Week ${weekId} has an invalid completion.`);
    if (!w.feedback.every(validFeedback)) return fail(`Week ${weekId} has invalid feedback.`);
    if (w.logs !== undefined && (!Array.isArray(w.logs) || !w.logs.every(validLog))) return fail(`Week ${weekId} has an invalid chore log.`);
  }
  return { ok: true, backup: x as unknown as Backup };
}
