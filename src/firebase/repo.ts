import {
  collection, deleteDoc, doc, getDocFromServer, getDocsFromServer, setDoc, updateDoc, writeBatch,
  type DocumentReference, type Firestore,
} from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import { track } from './pending';
import type { Budget, Chore, ChoreLog, Completion, Feedback, FeedbackKind, MemberId, Members, MoneyEntry, MoneyKind, MoneySettings, Multiplier, Percent } from '../domain/types';
import { other } from '../domain/types';
import { legacyHoursFor } from '../domain/blocks';
import { planLogWrites, type Backup } from '../domain/backup';
import { STARTER_CHORES, starterAssignee } from '../domain/starterChores';

const hh = (db: Firestore, code: string) => doc(db, 'households', code);
const choresCol = (db: Firestore, code: string) => collection(db, 'households', code, 'chores');
const weekDoc = (db: Firestore, code: string, weekId: string) => doc(db, 'households', code, 'weeks', weekId);
const budgetsCol = (db: Firestore, code: string) => collection(db, 'households', code, 'budgets');
const moneyCol = (db: Firestore, code: string) => collection(db, 'households', code, 'money');
const settingsDoc = (db: Firestore, code: string) => doc(db, 'households', code, 'settings', 'app');
const newId = () => crypto.randomUUID();

export async function householdExists(code: string): Promise<boolean> {
  await ensureSignedIn();
  return (await getDocFromServer(hh(getDb(), code))).exists();
}

export async function createHousehold(code: string, members: Members): Promise<void> {
  await ensureSignedIn();
  const db = getDb();
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(hh(db, code), { members, createdAt: now });
  STARTER_CHORES.forEach((c, i) =>
    batch.set(doc(choresCol(db, code), newId()), {
      name: c.name, hours: c.hours, assignee: starterAssignee(i), createdAt: now + i, archivedAt: null, blockMinutes: c.blockMinutes,
    }),
  );
  await track(batch.commit());
}

/** Dotted-path update so concurrent renames of the two members never overwrite each other. */
export async function renameMember(code: string, m: MemberId, name: string): Promise<void> {
  await ensureSignedIn();
  await track(updateDoc(hh(getDb(), code), { [`members.${m}.name`]: name }));
}

export async function addChore(code: string, input: { name: string; blockMinutes: number; assignee: MemberId }) {
  await ensureSignedIn();
  await track(setDoc(doc(choresCol(getDb(), code), newId()), {
    name: input.name, blockMinutes: input.blockMinutes, hours: legacyHoursFor(input.blockMinutes),
    assignee: input.assignee, createdAt: Date.now(), archivedAt: null,
  }));
}

export async function updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'blockMinutes' | 'assignee'>>) {
  await ensureSignedIn();
  await track(updateDoc(doc(choresCol(getDb(), code), id), patch));
}

export async function archiveChore(code: string, id: string) {
  await ensureSignedIn();
  await track(updateDoc(doc(choresCol(getDb(), code), id), { archivedAt: Date.now() }));
}

export async function addFeedback(code: string, weekId: string, input: { from: MemberId; kind: FeedbackKind; text: string }) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'feedback', newId()), {
    from: input.from, to: other(input.from), kind: input.kind, text: input.text.trim(),
    createdAt: Date.now(), resolved: false,
  });
  await track(batch.commit());
}

export async function deleteFeedback(code: string, weekId: string, id: string) {
  await ensureSignedIn();
  await track(deleteDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id)));
}

export async function setFeedbackResolved(code: string, weekId: string, id: string, resolved: boolean) {
  await ensureSignedIn();
  await track(updateDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id), { resolved }));
}

/** `id` lets the caller undo before the write is acknowledged (writes resolve only on server ack). */
export async function addLog(
  code: string, weekId: string,
  input: { chore: Pick<Chore, 'id' | 'name'>; by: MemberId; multiplier: Multiplier; blockMinutes: number; day: string },
  id: string = newId(),
) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'logs', id), {
    choreId: input.chore.id, name: input.chore.name, by: input.by, multiplier: input.multiplier,
    minutes: input.blockMinutes * input.multiplier, day: input.day, createdAt: Date.now(),
  });
  await track(batch.commit());
}

export async function deleteLog(code: string, weekId: string, id: string) {
  await ensureSignedIn();
  await track(deleteDoc(doc(weekDoc(getDb(), code, weekId), 'logs', id)));
}

export async function setupPocketMoney(
  code: string,
  input: { timeZone: string; personal: { a: number; b: number }; home: number; names: { a: string; b: string } },
) {
  await ensureSignedIn();
  const db = getDb();
  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(settingsDoc(db, code), { timeZone: input.timeZone, currency: 'GBP' });
  batch.set(doc(budgetsCol(db, code), 'personal-a'), { name: input.names.a.slice(0, 30), owner: 'a', monthlyAmount: input.personal.a, penalty: true, order: 0, createdAt: now, archivedAt: null });
  batch.set(doc(budgetsCol(db, code), 'personal-b'), { name: input.names.b.slice(0, 30), owner: 'b', monthlyAmount: input.personal.b, penalty: true, order: 1, createdAt: now, archivedAt: null });
  batch.set(doc(budgetsCol(db, code), 'home'), { name: 'Home', owner: 'shared', monthlyAmount: input.home, penalty: false, order: 2, createdAt: now, archivedAt: null });
  await track(batch.commit());
}

/** `id` lets the caller show the entry and delete it before the server acknowledges the write. */
export async function addMoneyEntry(
  code: string,
  input: { budgetId: string; by: MemberId; day: string; amount: number; label: string; kind: MoneyKind },
  id: string = newId(),
) {
  await ensureSignedIn();
  await track(setDoc(doc(moneyCol(getDb(), code), id), {
    budgetId: input.budgetId, by: input.by, day: input.day, amount: input.amount,
    label: input.label.trim().slice(0, 40), kind: input.kind, createdAt: Date.now(),
  }));
}

export async function deleteMoneyEntry(code: string, id: string) {
  await ensureSignedIn();
  await track(deleteDoc(doc(moneyCol(getDb(), code), id)));
}

export const toBudget = (id: string, d: Record<string, unknown>): Budget => ({
  id, name: d.name as string, owner: d.owner as Budget['owner'], monthlyAmount: d.monthlyAmount as number,
  penalty: Boolean(d.penalty), order: (d.order as number) ?? 0, createdAt: d.createdAt as number,
  archivedAt: (d.archivedAt as number | null) ?? null,
});
export const toMoneyEntry = (id: string, d: Record<string, unknown>): MoneyEntry => ({
  id, budgetId: d.budgetId as string, by: d.by as MemberId, day: d.day as string, amount: d.amount as number,
  label: (d.label as string) ?? '', kind: d.kind as MoneyKind, createdAt: d.createdAt as number,
});
export const toMoneySettings = (d: Record<string, unknown> | undefined): MoneySettings | null =>
  d && typeof d.timeZone === 'string' ? { timeZone: d.timeZone, currency: 'GBP' } : null;

export const toChore = (id: string, d: Record<string, unknown>): Chore => ({
  id, name: d.name as string, hours: d.hours as number, assignee: d.assignee as MemberId,
  createdAt: d.createdAt as number, archivedAt: (d.archivedAt as number | null) ?? null,
  ...(typeof d.blockMinutes === 'number' ? { blockMinutes: d.blockMinutes } : {}),
});
export const toLog = (id: string, d: Record<string, unknown>): ChoreLog => ({
  id, choreId: d.choreId as string, name: d.name as string, by: d.by as MemberId,
  multiplier: d.multiplier as Multiplier, minutes: d.minutes as number, day: d.day as string, createdAt: d.createdAt as number,
});
export const toCompletion = (id: string, d: Record<string, unknown>): Completion => ({
  choreId: id, percent: d.percent as Percent, name: d.name as string, hours: d.hours as number,
  assignee: d.assignee as MemberId, updatedAt: d.updatedAt as number,
});
export const toFeedback = (id: string, d: Record<string, unknown>): Feedback => ({
  id, from: d.from as MemberId, to: d.to as MemberId, kind: d.kind as FeedbackKind,
  text: d.text as string, createdAt: d.createdAt as number, resolved: Boolean(d.resolved),
});

export async function exportHousehold(code: string): Promise<Backup> {
  await ensureSignedIn();
  const db = getDb();
  const h = await getDocFromServer(hh(db, code));
  if (!h.exists()) throw new Error('Household not found.');
  const chores = (await getDocsFromServer(choresCol(db, code))).docs.map((d) => toChore(d.id, d.data()));
  const weeks: Backup['weeks'] = {};
  const weekDocs = (await getDocsFromServer(collection(db, 'households', code, 'weeks'))).docs;
  await Promise.all(weekDocs.map(async (w) => {
    const [c, f, l] = await Promise.all([
      getDocsFromServer(collection(w.ref, 'completions')),
      getDocsFromServer(collection(w.ref, 'feedback')),
      getDocsFromServer(collection(w.ref, 'logs')),
    ]);
    weeks[w.id] = {
      completions: c.docs.map((d) => toCompletion(d.id, d.data())),
      feedback: f.docs.map((d) => toFeedback(d.id, d.data())),
      logs: l.docs.map((d) => toLog(d.id, d.data())),
    };
  }));
  const [sd, bd, md] = await Promise.all([
    getDocFromServer(settingsDoc(db, code)),
    getDocsFromServer(budgetsCol(db, code)),
    getDocsFromServer(moneyCol(db, code)),
  ]);
  const money = {
    settings: toMoneySettings(sd.exists() ? sd.data() : undefined),
    budgets: bd.docs.map((d) => toBudget(d.id, d.data())),
    entries: md.docs.map((d) => toMoneyEntry(d.id, d.data())),
  };
  return { version: 1, exportedAt: Date.now(), code, members: h.data().members as Members, chores, weeks, money };
}

type Op = { ref: DocumentReference; data?: Record<string, unknown> };

async function commitInChunks(db: Firestore, ops: Op[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      if (op.data) batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await track(batch.commit());
  }
}

/** Replaces everything under `code`. Writes the backup first, then removes docs not in it, so a failed import never empties the household. */
export async function importHousehold(code: string, backup: Backup): Promise<void> {
  await ensureSignedIn();
  const db = getDb();

  // Read existing docs before writing so stale ones can be found, but delete only after the sets succeed.
  const existing: DocumentReference[] = (await getDocsFromServer(choresCol(db, code))).docs.map((d) => d.ref);
  for (const w of (await getDocsFromServer(collection(db, 'households', code, 'weeks'))).docs) {
    for (const sub of ['completions', 'feedback', 'logs']) {
      (await getDocsFromServer(collection(w.ref, sub))).docs.forEach((d) => existing.push(d.ref));
    }
    existing.push(w.ref);
  }

  // Old backups have no money section: leave Pocket Money data untouched (not scanned, so never deleted).
  if (backup.money) {
    const sd = await getDocFromServer(settingsDoc(db, code));
    if (sd.exists()) existing.push(sd.ref);
    (await getDocsFromServer(budgetsCol(db, code))).docs.forEach((d) => existing.push(d.ref));
    (await getDocsFromServer(moneyCol(db, code))).docs.forEach((d) => existing.push(d.ref));
  }

  const existingPaths = new Set(existing.map((r) => r.path));

  const sets: Op[] = [{
    ref: hh(db, code),
    data: { members: { a: { name: backup.members.a.name }, b: { name: backup.members.b.name } }, createdAt: Date.now() },
  }];
  const keep = new Set<string>([hh(db, code).path]);
  const add = (ref: DocumentReference, data: Record<string, unknown>) => { sets.push({ ref, data }); keep.add(ref.path); };

  for (const c of backup.chores) {
    add(doc(choresCol(db, code), c.id), {
      name: c.name, hours: c.hours, assignee: c.assignee, createdAt: c.createdAt, archivedAt: c.archivedAt,
      ...(c.blockMinutes !== undefined ? { blockMinutes: c.blockMinutes } : {}),
    });
  }
  for (const [weekId, w] of Object.entries(backup.weeks)) {
    add(weekDoc(db, code, weekId), { weekId });
    for (const c of w.completions) {
      add(doc(weekDoc(db, code, weekId), 'completions', c.choreId), {
        percent: c.percent, name: c.name, hours: c.hours, assignee: c.assignee, updatedAt: c.updatedAt,
      });
    }
    for (const f of w.feedback) {
      add(doc(weekDoc(db, code, weekId), 'feedback', f.id), {
        from: f.from, to: f.to, kind: f.kind, text: f.text, createdAt: f.createdAt, resolved: f.resolved,
      });
    }
    const logs = w.logs ?? [];
    const logRef = (id: string) => doc(weekDoc(db, code, weekId), 'logs', id);
    const toWrite = new Set(planLogWrites(logs.map((l) => logRef(l.id).path), existingPaths));
    for (const l of logs) {
      const ref = logRef(l.id);
      if (!toWrite.has(ref.path)) { keep.add(ref.path); continue; }
      add(ref, {
        choreId: l.choreId, name: l.name, by: l.by, multiplier: l.multiplier, minutes: l.minutes, day: l.day, createdAt: l.createdAt,
      });
    }
  }

  if (backup.money) {
    const mo = backup.money;
    if (mo.settings) add(settingsDoc(db, code), { timeZone: mo.settings.timeZone, currency: 'GBP' });
    for (const b of mo.budgets) {
      add(doc(budgetsCol(db, code), b.id), {
        name: b.name, owner: b.owner, monthlyAmount: b.monthlyAmount, penalty: b.penalty, order: b.order,
        createdAt: b.createdAt, archivedAt: b.archivedAt,
      });
    }
    // Money entries are create-only like logs: skip ones that already exist, but keep them.
    const entryRef = (id: string) => doc(moneyCol(db, code), id);
    const entryWrites = new Set(planLogWrites(mo.entries.map((e) => entryRef(e.id).path), existingPaths));
    for (const e of mo.entries) {
      const ref = entryRef(e.id);
      if (!entryWrites.has(ref.path)) { keep.add(ref.path); continue; }
      add(ref, { budgetId: e.budgetId, by: e.by, day: e.day, amount: e.amount, label: e.label, kind: e.kind, createdAt: e.createdAt });
    }
  }

  await commitInChunks(db, sets);
  await commitInChunks(db, existing.filter((r) => !keep.has(r.path)).map((ref) => ({ ref })));
}
