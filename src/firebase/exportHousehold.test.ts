import { exportHousehold } from './repo';

let denyMoney: string | null = null;
vi.mock('./app', () => ({ ensureSignedIn: async () => {}, getDb: () => ({}) }));
vi.mock('./pending', () => ({ track: <T,>(p: T) => p }));
vi.mock('firebase/firestore', () => {
  const ref = (path: string) => ({ path });
  const fail = (path: string) => {
    if (denyMoney && path.includes(denyMoney)) throw Object.assign(new Error('denied'), { code: denyMoney === 'budgets' ? 'permission-denied' : 'unavailable' });
  };
  return {
    doc: (_d: unknown, ...p: string[]) => ref(p.join('/')),
    collection: (_d: unknown, ...p: string[]) => ref(p.join('/')),
    getDocFromServer: async (r: { path: string }) => {
      fail(r.path);
      return r.path === 'households/c'
        ? { exists: () => true, data: () => ({ members: { a: { name: 'A' }, b: { name: 'B' } } }) }
        : { exists: () => false, data: () => undefined };
    },
    getDocsFromServer: async (r: { path: string }) => { fail(r.path); return { docs: [] }; },
    writeBatch: () => ({}), runTransaction: async () => {}, setDoc: async () => {}, deleteDoc: async () => {}, updateDoc: async () => {},
  };
});

afterEach(() => { denyMoney = null; });

test('includes the money section when readable', async () => {
  const b = await exportHousehold('c');
  expect(b.money).toEqual({ settings: null, budgets: [], entries: [] });
});

test('permission-denied on money omits the section but still exports the rest', async () => {
  denyMoney = 'budgets';
  const b = await exportHousehold('c');
  expect(b.money).toBeUndefined();
  expect(b.code).toBe('c');
});

test('other money read errors are rethrown', async () => {
  denyMoney = 'money';
  await expect(exportHousehold('c')).rejects.toThrow('denied');
});
