import { act, renderHook } from '@testing-library/react';
import { useMoney } from './hooks';

type Listener = (s: unknown) => void;
const listeners: { path: string; next: Listener }[] = [];
vi.mock('./app', () => ({ ensureSignedIn: async () => {}, getDb: () => ({}) }));
vi.mock('./pending', () => ({ onPendingChange: () => () => {}, pendingWrites: () => 0 }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
  query: (c: { path: string }, ...w: { tag: string }[]) => ({ path: `${c.path}?${w.map((x) => x.tag).join('&')}` }),
  where: (f: string, op: string, v: string) => ({ tag: `${f}${op}${v}` }),
  onSnapshot: (ref: { path: string }, ...rest: unknown[]) => {
    const next = rest.find((r) => typeof r === 'function') as Listener;
    const entry = { path: ref.path, next };
    listeners.push(entry);
    return () => { listeners.splice(listeners.indexOf(entry), 1); };
  },
}));

const emptyDocs = { docs: [], exists: () => false, data: () => undefined, metadata: { fromCache: false } };
const deliverAll = () => act(() => { [...listeners].forEach((l) => l.next(emptyDocs)); });

beforeEach(() => { listeners.length = 0; });

test('a month change keeps loading false and the previous data; a code change resets loading', async () => {
  const { result, rerender } = renderHook(({ code, month }) => useMoney(code, month), { initialProps: { code: 'c', month: '2026-10' } });
  await act(async () => {});
  expect(result.current.loading).toBe(true);
  deliverAll();
  expect(result.current.loading).toBe(false);

  rerender({ code: 'c', month: '2026-11' });
  expect(result.current.loading).toBe(false);
  expect(listeners.some((l) => l.path.includes('2026-11'))).toBe(true);

  rerender({ code: 'd', month: '2026-11' });
  expect(result.current.loading).toBe(true);
});
