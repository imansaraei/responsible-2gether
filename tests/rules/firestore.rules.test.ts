import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const CODE = 'tidy-otter-maple-4821';
const household = { members: { a: { name: 'Iman' }, b: { name: 'Sam' } }, createdAt: 1 };
const chore = { name: 'Cooking', hours: 7, assignee: 'a', createdAt: 1, archivedAt: null };
const completion = { percent: 50, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 1 };
const feedback = { from: 'a', to: 'b', kind: 'minus', text: 'Dishes left out', createdAt: 1, resolved: false };

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-r2g',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const authed = () => env.authenticatedContext('device-1').firestore();
const anon = () => env.unauthenticatedContext().firestore();
const h = (db: ReturnType<typeof authed>, ...p: string[]) => doc(db, 'households', CODE, ...p);

test('signed-in device can create and read a household', async () => {
  await assertSucceeds(setDoc(h(authed()), household));
  await assertSucceeds(getDoc(h(authed())));
});

test('unauthenticated client cannot read', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'households', CODE), household));
  await assertFails(getDoc(h(anon())));
});

test('households cannot be listed', async () => {
  await assertFails(getDocs(collection(authed(), 'households')));
});

test('rejects malformed codes and extra fields', async () => {
  await assertFails(setDoc(doc(authed(), 'households', 'not-a-code'), household));
  await assertFails(setDoc(h(authed()), { ...household, admin: true }));
});

test('chore validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'chores', 'c1'), chore));
  await assertFails(setDoc(h(authed(), 'chores', 'c2'), { ...chore, hours: 0 }));
  await assertFails(setDoc(h(authed(), 'chores', 'c3'), { ...chore, assignee: 'c' }));
});

test('completion validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41', 'completions', 'c1'), completion));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'completions', 'c1'), { ...completion, percent: 30 }));
});

test('week marker must match its id', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41'), { weekId: '2026-W41' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41'), { weekId: '2026-W40' }));
});

test('feedback validation', async () => {
  await assertSucceeds(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f1'), feedback));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f2'), { ...feedback, to: 'a' }));
  await assertFails(setDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f3'), { ...feedback, text: '' }));
});

const seed = (path: string[], data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'households', CODE, ...path), data));

test('a dotted member-name update passes', async () => {
  await seed([], household);
  await assertSucceeds(updateDoc(h(authed()), { 'members.b.name': 'Samira' }));
  const snap = await getDoc(h(authed()));
  expect(snap.data()!.members).toEqual({ a: { name: 'Iman' }, b: { name: 'Samira' } });
  await assertFails(updateDoc(h(authed()), { 'members.b.name': '' }));
});

test('partial archivedAt and resolved updates pass', async () => {
  await seed(['chores', 'c1'], chore);
  await seed(['weeks', '2026-W41', 'feedback', 'f1'], feedback);
  await assertSucceeds(updateDoc(h(authed(), 'chores', 'c1'), { archivedAt: 1234 }));
  await assertSucceeds(updateDoc(h(authed(), 'weeks', '2026-W41', 'feedback', 'f1'), { resolved: true }));
});

test('an import-shaped batch (sets plus a stale delete) passes for a signed-in device', async () => {
  await seed(['chores', 'stale'], chore);
  const db = authed();
  const batch = writeBatch(db);
  batch.set(h(db), household);
  batch.set(h(db, 'chores', 'c1'), chore);
  batch.set(h(db, 'weeks', '2026-W41'), { weekId: '2026-W41' });
  batch.set(h(db, 'weeks', '2026-W41', 'completions', 'c1'), completion);
  batch.set(h(db, 'weeks', '2026-W41', 'feedback', 'f1'), feedback);
  batch.delete(h(db, 'chores', 'stale'));
  await assertSucceeds(batch.commit());
  expect((await getDoc(h(authed(), 'chores', 'stale'))).exists()).toBe(false);
  expect((await getDoc(h(authed(), 'chores', 'c1'))).exists()).toBe(true);
});
