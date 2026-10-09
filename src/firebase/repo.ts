import {
  collection, deleteDoc, doc, getDocFromServer, getDocsFromServer, setDoc, updateDoc, writeBatch,
  type DocumentReference, type Firestore,
} from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
import { track } from './pending';
import type { Chore, Completion, Feedback, FeedbackKind, MemberId, Members, Percent } from '../domain/types';
import { other } from '../domain/types';
import type { ChoreView } from '../domain/scoring';
import type { Backup } from '../domain/backup';
import { STARTER_CHORES, starterAssignee } from '../domain/starterChores';

const hh = (db: Firestore, code: string) => doc(db, 'households', code);
const choresCol = (db: Firestore, code: string) => collection(db, 'households', code, 'chores');
const weekDoc = (db: Firestore, code: string, weekId: string) => doc(db, 'households', code, 'weeks', weekId);
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
      name: c.name, hours: c.hours, assignee: starterAssignee(i), createdAt: now + i, archivedAt: null,
    }),
  );
  await track(batch.commit());
}

/** Dotted-path update so concurrent renames of the two members never overwrite each other. */
export async function renameMember(code: string, m: MemberId, name: string): Promise<void> {
  await ensureSignedIn();
  await track(updateDoc(hh(getDb(), code), { [`members.${m}.name`]: name }));
}

export async function addChore(code: string, input: { name: string; hours: number; assignee: MemberId }) {
  await ensureSignedIn();
  await track(setDoc(doc(choresCol(getDb(), code), newId()), { ...input, createdAt: Date.now(), archivedAt: null }));
}

export async function updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'assignee'>>) {
  await ensureSignedIn();
  await track(updateDoc(doc(choresCol(getDb(), code), id), patch));
}

export async function archiveChore(code: string, id: string) {
  await ensureSignedIn();
  await track(updateDoc(doc(choresCol(getDb(), code), id), { archivedAt: Date.now() }));
}

export async function setCompletion(code: string, weekId: string, view: ChoreView, percent: Percent) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'completions', view.choreId), {
    percent, name: view.name, hours: view.hours, assignee: view.assignee, updatedAt: Date.now(),
  });
  await track(batch.commit());
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

export const toChore = (id: string, d: Record<string, unknown>): Chore => ({
  id, name: d.name as string, hours: d.hours as number, assignee: d.assignee as MemberId,
  createdAt: d.createdAt as number, archivedAt: (d.archivedAt as number | null) ?? null,
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
    const [c, f] = await Promise.all([
      getDocsFromServer(collection(w.ref, 'completions')),
      getDocsFromServer(collection(w.ref, 'feedback')),
    ]);
    weeks[w.id] = {
      completions: c.docs.map((d) => toCompletion(d.id, d.data())),
      feedback: f.docs.map((d) => toFeedback(d.id, d.data())),
    };
  }));
  return { version: 1, exportedAt: Date.now(), code, members: h.data().members as Members, chores, weeks };
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

  const sets: Op[] = [{
    ref: hh(db, code),
    data: { members: { a: { name: backup.members.a.name }, b: { name: backup.members.b.name } }, createdAt: Date.now() },
  }];
  const keep = new Set<string>([hh(db, code).path]);
  const add = (ref: DocumentReference, data: Record<string, unknown>) => { sets.push({ ref, data }); keep.add(ref.path); };

  for (const c of backup.chores) {
    add(doc(choresCol(db, code), c.id), {
      name: c.name, hours: c.hours, assignee: c.assignee, createdAt: c.createdAt, archivedAt: c.archivedAt,
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
  }

  // Read existing docs before writing so stale ones can be found, but delete only after the sets succeed.
  const existing: DocumentReference[] = (await getDocsFromServer(choresCol(db, code))).docs.map((d) => d.ref);
  for (const w of (await getDocsFromServer(collection(db, 'households', code, 'weeks'))).docs) {
    for (const sub of ['completions', 'feedback']) {
      (await getDocsFromServer(collection(w.ref, sub))).docs.forEach((d) => existing.push(d.ref));
    }
    existing.push(w.ref);
  }

  await commitInChunks(db, sets);
  await commitInChunks(db, existing.filter((r) => !keep.has(r.path)).map((ref) => ({ ref })));
}
