import { onPendingChange, pendingWrites, track } from './pending';

test('counts pending writes and notifies listeners, even on failure', async () => {
  const seen: number[] = [];
  const off = onPendingChange(() => seen.push(pendingWrites()));
  let resolve!: () => void;
  const ok = track(new Promise<void>((r) => { resolve = r; }));
  const bad = track(Promise.reject(new Error('nope')));
  await expect(bad).rejects.toThrow('nope');
  expect(pendingWrites()).toBe(1);
  resolve();
  await ok;
  expect(pendingWrites()).toBe(0);
  expect(seen).toEqual([1, 2, 1, 0]);
  off();
  await track(Promise.resolve());
  expect(seen).toHaveLength(4);
});
