import {
  collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  type DocumentReference, type Firestore,
} from 'firebase/firestore';
import { ensureSignedIn, getDb } from './app';
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
  return (await getDoc(hh(getDb(), code))).exists();
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
  await batch.commit();
}

export async function updateMembers(code: string, members: Members): Promise<void> {
  await ensureSignedIn();
  await updateDoc(hh(getDb(), code), { members });
}

export async function addChore(code: string, input: { name: string; hours: number; assignee: MemberId }) {
  await ensureSignedIn();
  await setDoc(doc(choresCol(getDb(), code), newId()), { ...input, createdAt: Date.now(), archivedAt: null });
}

export async function updateChore(code: string, id: string, patch: Partial<Pick<Chore, 'name' | 'hours' | 'assignee'>>) {
  await ensureSignedIn();
  await updateDoc(doc(choresCol(getDb(), code), id), patch);
}

export async function archiveChore(code: string, id: string) {
  await ensureSignedIn();
  await updateDoc(doc(choresCol(getDb(), code), id), { archivedAt: Date.now() });
}

export async function setCompletion(code: string, weekId: string, view: ChoreView, percent: Percent) {
  await ensureSignedIn();
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(weekDoc(db, code, weekId), { weekId });
  batch.set(doc(weekDoc(db, code, weekId), 'completions', view.choreId), {
    percent, name: view.name, hours: view.hours, assignee: view.assignee, updatedAt: Date.now(),
  });
  await batch.commit();
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
  await batch.commit();
}

export async function deleteFeedback(code: string, weekId: string, id: string) {
  await ensureSignedIn();
  await deleteDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id));
}

export async function setFeedbackResolved(code: string, weekId: string, id: string, resolved: boolean) {
  await ensureSignedIn();
  await updateDoc(doc(weekDoc(getDb(), code, weekId), 'feedback', id), { resolved });
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
  const h = await getDoc(hh(db, code));
  if (!h.exists()) throw new Error('Household not found.');
  const chores = (await getDocs(choresCol(db, code))).docs.map((d) => toChore(d.id, d.data()));
  const weeks: Backup['weeks'] = {};
  for (const w of (await getDocs(collection(db, 'households', code, 'weeks'))).docs) {
    const [c, f] = await Promise.all([
      getDocs(collection(w.ref, 'completions')),
      getDocs(collection(w.ref, 'feedback')),
    ]);
    weeks[w.id] = {
      completions: c.docs.map((d) => toCompletion(d.id, d.data())),
      feedback: f.docs.map((d) => toFeedback(d.id, d.data())),
    };
  }
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
    await batch.commit();
  }
}

export async function importHousehold(code: string, backup: Backup): Promise<void> {
  await ensureSignedIn();
  const db = getDb();
  const deletes: Op[] = (await getDocs(choresCol(db, code))).docs.map((d) => ({ ref: d.ref }));
  for (const w of (await getDocs(collection(db, 'households', code, 'weeks'))).docs) {
    for (const sub of ['completions', 'feedback']) {
      (await getDocs(collection(w.ref, sub))).docs.forEach((d) => deletes.push({ ref: d.ref }));
    }
    deletes.push({ ref: w.ref });
  }
  await commitInChunks(db, deletes);

  const sets: Op[] = [{ ref: hh(db, code), data: { members: backup.members, createdAt: Date.now() } }];
  for (const { id, ...c } of backup.chores) sets.push({ ref: doc(choresCol(db, code), id), data: c });
  for (const [weekId, w] of Object.entries(backup.weeks)) {
    sets.push({ ref: weekDoc(db, code, weekId), data: { weekId } });
    for (const { choreId, ...c } of w.completions) sets.push({ ref: doc(weekDoc(db, code, weekId), 'completions', choreId), data: c });
    for (const { id, ...f } of w.feedback) sets.push({ ref: doc(weekDoc(db, code, weekId), 'feedback', id), data: f });
  }
  await commitInChunks(db, sets);
}
