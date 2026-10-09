import type { Chore, Completion, Feedback, Members } from './types';
import { PERCENTS } from './types';
import { isValidCode } from './householdCode';

export interface Backup {
  version: 1;
  exportedAt: number;
  code: string;
  members: Members;
  chores: Chore[];
  weeks: Record<string, { completions: Completion[]; feedback: Feedback[] }>;
}

type R = { ok: true; backup: Backup } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown, max: number) => typeof x === 'string' && x.length > 0 && x.length <= max;
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const isMember = (x: unknown) => x === 'a' || x === 'b';
const isHours = (x: unknown) => isNum(x) && (x as number) >= 0.25 && (x as number) <= 40;

const validChore = (c: unknown) =>
  isObj(c) && isStr(c.id, 100) && isStr(c.name, 60) && isHours(c.hours) && isMember(c.assignee) &&
  isNum(c.createdAt) && (c.archivedAt === null || isNum(c.archivedAt));

const validCompletion = (c: unknown) =>
  isObj(c) && isStr(c.choreId, 100) && PERCENTS.includes(c.percent as never) && isStr(c.name, 60) &&
  isHours(c.hours) && isMember(c.assignee) && isNum(c.updatedAt);

const validFeedback = (f: unknown) =>
  isObj(f) && isStr(f.id, 100) && isMember(f.from) && isMember(f.to) && f.from !== f.to &&
  (f.kind === 'plus' || f.kind === 'minus') && isStr(f.text, 280) && isNum(f.createdAt) &&
  typeof f.resolved === 'boolean';

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
  }
  return { ok: true, backup: x as unknown as Backup };
}
